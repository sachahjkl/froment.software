import {
  AuthenticationRequired,
  ApiToken as ApiTokenSchema,
  ApiTokenInvalidExpiration,
  ApiTokenInvalidCursor,
  ApiTokenNameConflict,
  ApiTokenNotFound,
  ApiTokenSecret,
  ApiTokenPermissionCode,
  PermissionDenied,
  Ulid,
  type ApiTokenPermissionCodeValue,
  type ApiTokenCreateRequestValue,
  type ApiTokenCreatedValue,
  type ApiTokenPageValue,
  type ApiTokenValue,
  type PermissionCodeValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Option, Schema } from 'effect';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError, isSqliteError } from '../database/database.js';
import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { RuntimeConfiguration } from '../runtime-config.js';

const tokenPrefix = 'froment_api_v1_';

const ApiTokenRecord = Schema.Struct({
  id: Ulid,
  userId: Ulid,
  name: Schema.String,
  tokenHmac: Schema.Uint8Array,
  createdAt: Schema.Number,
  expiresAt: Schema.Number,
  lastUsedAt: Schema.NullOr(Schema.Number),
  revokedAt: Schema.NullOr(Schema.Number),
  rateLimitPerMinute: Schema.Number,
});

export interface ApiTokenPrincipal {
  readonly userId: UlidValue;
  readonly tokenId: UlidValue;
  readonly rateLimitPerMinute: number;
}

export interface ApiTokensService {
  readonly list: (
    cursor?: UlidValue,
    limit?: number,
  ) => Effect.Effect<ApiTokenPageValue, ApiTokenInvalidCursor | DatabaseError>;
  readonly create: (
    request: ApiTokenCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    ApiTokenCreatedValue,
    ApiTokenInvalidExpiration | ApiTokenNameConflict | PermissionDenied | DatabaseError
  >;
  readonly authenticate: (
    token: string,
  ) => Effect.Effect<ApiTokenPrincipal, AuthenticationRequired | DatabaseError>;
  readonly authorizePermission: (
    principal: ApiTokenPrincipal,
    permission: PermissionCodeValue,
  ) => Effect.Effect<void, PermissionDenied | DatabaseError>;
  readonly revoke: (
    tokenId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<ApiTokenValue, ApiTokenNotFound | DatabaseError>;
}

export class ApiTokens extends Context.Service<ApiTokens, ApiTokensService>()(
  '@froment/api/ApiTokens',
) {}

export const ApiTokensLive = Layer.effect(
  ApiTokens,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;
    const runtime = yield* RuntimeConfiguration;
    const audit = yield* Audit;

    const permissions = (tokenId: string): ReadonlyArray<ApiTokenPermissionCodeValue> =>
      Schema.decodeUnknownSync(Schema.Array(ApiTokenPermissionCode))(
        database.sqlite
          .prepare(
            `select permission_code from api_token_permissions
             where token_id = ? order by permission_code`,
          )
          .pluck()
          .all(tokenId),
      );

    const read = (tokenId: string): ApiTokenValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select id, name, created_at as createdAt, expires_at as expiresAt,
                  last_used_at as lastUsedAt, revoked_at as revokedAt,
                  rate_limit_per_minute as rateLimitPerMinute
             from api_tokens where id = ?`,
        )
        .get(tokenId);
      if (row === undefined) return undefined;
      return Schema.decodeUnknownSync(ApiTokenSchema)({
        ...Schema.decodeUnknownSync(
          Schema.Struct({
            id: Schema.String,
            name: Schema.String,
            createdAt: Schema.Number,
            expiresAt: Schema.Number,
            lastUsedAt: Schema.NullOr(Schema.Number),
            revokedAt: Schema.NullOr(Schema.Number),
            rateLimitPerMinute: Schema.Number,
          }),
        )(row),
        permissions: permissions(tokenId),
      });
    };

    const ApiTokenListRow = Schema.Struct({
      id: Ulid,
      name: Schema.String,
      createdAt: Schema.Number,
      expiresAt: Schema.Number,
      lastUsedAt: Schema.NullOr(Schema.Number),
      revokedAt: Schema.NullOr(Schema.Number),
      rateLimitPerMinute: Schema.Number,
      permissions: Schema.String,
    });
    const CursorBoundary = Schema.Struct({ createdAt: Schema.Number, id: Ulid });
    const decodePermissions = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Array(ApiTokenPermissionCode)),
    );
    const tokenPageSelection = `select api_tokens.id, api_tokens.name,
                                       api_tokens.created_at as createdAt,
                                       api_tokens.expires_at as expiresAt,
                                       api_tokens.last_used_at as lastUsedAt,
                                       api_tokens.revoked_at as revokedAt,
                                       api_tokens.rate_limit_per_minute as rateLimitPerMinute,
                                       coalesce((
                                         select json_group_array(permission_code)
                                           from (
                                             select permission_code
                                               from api_token_permissions
                                              where token_id = api_tokens.id
                                              order by permission_code
                                           )
                                       ), '[]') as permissions
                                  from api_tokens`;
    const firstTokenPage = database.sqlite.prepare(
      `${tokenPageSelection}
       order by api_tokens.created_at desc, api_tokens.id desc
       limit ?`,
    );
    const nextTokenPage = database.sqlite.prepare(
      `${tokenPageSelection}
       where (api_tokens.created_at, api_tokens.id) < (?, ?)
       order by api_tokens.created_at desc, api_tokens.id desc
       limit ?`,
    );

    const list = Effect.fn('ApiTokens.list')(function* (
      cursor?: UlidValue,
      limit = runtime.apiToken.defaultPageSize,
    ) {
      return yield* Effect.try({
        try: () => {
          const boundary =
            cursor === undefined
              ? undefined
              : Schema.decodeUnknownOption(CursorBoundary)(
                  database.sqlite
                    .prepare(
                      `select created_at as createdAt, id
                         from api_tokens
                        where id = ?`,
                    )
                    .get(cursor),
                ).pipe(Option.getOrUndefined);
          if (cursor !== undefined && boundary === undefined) {
            throw new ApiTokenInvalidCursor({ code: 'api_token.invalid_cursor' });
          }
          const rows = Schema.decodeUnknownSync(Schema.Array(ApiTokenListRow))(
            boundary === undefined
              ? firstTokenPage.all(limit + 1)
              : nextTokenPage.all(boundary.createdAt, boundary.id, limit + 1),
          );
          const hasMore = rows.length > limit;
          const items = rows.slice(0, limit).map(({ permissions: encodedPermissions, ...row }) =>
            Schema.decodeUnknownSync(ApiTokenSchema)({
              ...row,
              permissions: decodePermissions(encodedPermissions),
            }),
          );
          return {
            items,
            nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
          } satisfies ApiTokenPageValue;
        },
        catch: (cause) =>
          cause instanceof ApiTokenInvalidCursor
            ? cause
            : new DatabaseError({ operation: 'list.api.tokens', cause }),
      });
    });

    const create = Effect.fn('ApiTokens.create')(function* (
      request: ApiTokenCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      if (
        request.expiresAt <= now ||
        request.expiresAt > now + runtime.apiToken.maximumLifetimeMillis
      ) {
        return yield* new ApiTokenInvalidExpiration({
          code: 'api_token.invalid_expiration',
        });
      }
      const requestedPermissions = [...request.permissions].sort();
      const allowedPermissions = yield* Effect.try({
        try: () =>
          new Set(
            Schema.decodeUnknownSync(Schema.Array(Schema.String))(
              database.sqlite
                .prepare(
                  `select role_permissions.permission_code
                     from user_roles
                     join role_permissions on role_permissions.role_id = user_roles.role_id
                    where user_roles.user_id = ?`,
                )
                .pluck()
                .all(actorUserId),
            ),
          ),
        catch: (cause) => new DatabaseError({ operation: 'read.api.token.permissions', cause }),
      });
      if (requestedPermissions.some((permission) => !allowedPermissions.has(permission))) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }

      const tokenId = Schema.decodeUnknownSync(Ulid)(ulid(now));
      const secret = `${tokenPrefix}${tokenId}.${randomBytes(32).toString('base64url')}`;
      const name = request.name.trim();
      const rateLimitPerMinute =
        request.rateLimitPerMinute ?? runtime.apiToken.defaultRateLimitPerMinute;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare(
                  `insert into api_tokens
                   (id, user_id, name, token_hmac, created_at, expires_at, rate_limit_per_minute)
                   values (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  tokenId,
                  actorUserId,
                  name,
                  hmac(config.apiTokenHmacKey, secret),
                  now,
                  request.expiresAt,
                  rateLimitPerMinute,
                );
              const insertPermission = database.sqlite.prepare(
                `insert into api_token_permissions (token_id, permission_code)
                 values (?, ?)`,
              );
              for (const permission of requestedPermissions) {
                insertPermission.run(tokenId, permission);
              }
              audit.insert({
                action: 'api.token-created',
                actorUserId,
                resourceType: 'api-token',
                resourceId: tokenId,
                metadata: {
                  name,
                  expiresAt: request.expiresAt.toString(),
                  permissionCount: requestedPermissions.length.toString(),
                  rateLimitPerMinute: rateLimitPerMinute.toString(),
                },
                occurredAt: now,
              });
              const token = read(tokenId);
              if (token === undefined) throw new Error('api_token.created.missing');
              return Schema.decodeUnknownSync(
                Schema.Struct({ token: ApiTokenSchema, secret: ApiTokenSecret }),
              )({ token, secret });
            })
            .immediate(),
        catch: (cause) =>
          isSqliteError(cause, 'SQLITE_CONSTRAINT_TRIGGER')
            ? new ApiTokenNameConflict({ code: 'api_token.name_conflict' })
            : new DatabaseError({ operation: 'create.api.token', cause }),
      });
    });

    const authenticate = Effect.fn('ApiTokens.authenticate')(function* (candidate: string) {
      const decoded = Schema.decodeUnknownOption(ApiTokenSecret)(candidate);
      if (Option.isNone(decoded)) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      const tokenId = Schema.decodeUnknownSync(Ulid)(
        candidate.slice(tokenPrefix.length, tokenPrefix.length + 26),
      );
      const now = yield* Clock.currentTimeMillis;
      const record = yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select api_tokens.id, api_tokens.user_id as userId,
                      api_tokens.name, api_tokens.token_hmac as tokenHmac,
                      api_tokens.created_at as createdAt,
                      api_tokens.expires_at as expiresAt,
                      api_tokens.last_used_at as lastUsedAt,
                      api_tokens.revoked_at as revokedAt,
                      api_tokens.rate_limit_per_minute as rateLimitPerMinute
                 from api_tokens
                 join users on users.id = api_tokens.user_id
                where api_tokens.id = ?
                  and users.kind = 'administrator'
                  and users.disabled_at is null
                limit 1`,
            )
            .get(tokenId);
          return row === undefined ? undefined : Schema.decodeUnknownSync(ApiTokenRecord)(row);
        },
        catch: (cause) => new DatabaseError({ operation: 'read.api.token', cause }),
      });
      const candidateHmac = hmac(config.apiTokenHmacKey, candidate);
      if (
        record === undefined ||
        record.revokedAt !== null ||
        record.expiresAt <= now ||
        !timingSafeEqual(candidateHmac, record.tokenHmac)
      ) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `update api_tokens set last_used_at = ?
               where id = ? and (last_used_at is null or last_used_at <= ?)`,
            )
            .run(now, record.id, now - runtime.apiToken.lastUsedUpdateIntervalMillis),
        catch: (cause) => new DatabaseError({ operation: 'update.api.token.use', cause }),
      });
      return {
        userId: record.userId,
        tokenId: record.id,
        rateLimitPerMinute: record.rateLimitPerMinute,
      };
    });

    const authorizePermission = Effect.fn('ApiTokens.authorizePermission')(function* (
      principal: ApiTokenPrincipal,
      permission: PermissionCodeValue,
    ) {
      const allowed = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select 1
                 from api_token_permissions
                 join user_roles on user_roles.user_id = ?
                 join role_permissions
                   on role_permissions.role_id = user_roles.role_id
                  and role_permissions.permission_code = api_token_permissions.permission_code
                where api_token_permissions.token_id = ?
                  and api_token_permissions.permission_code = ?
                limit 1`,
            )
            .get(principal.userId, principal.tokenId, permission) !== undefined,
        catch: (cause) => new DatabaseError({ operation: 'authorize.api.token.permission', cause }),
      });
      if (!allowed) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
    });

    const revoke = Effect.fn('ApiTokens.revoke')(function* (
      tokenId: UlidValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const token = read(tokenId);
              if (token === undefined) {
                throw new ApiTokenNotFound({ code: 'api_token.not_found' });
              }
              if (token.revokedAt === null) {
                database.sqlite
                  .prepare(
                    `update api_tokens set revoked_at = ?, revoked_by_user_id = ?
                     where id = ? and revoked_at is null`,
                  )
                  .run(now, actorUserId, tokenId);
                audit.insert({
                  action: 'api.token-revoked',
                  actorUserId,
                  resourceType: 'api-token',
                  resourceId: tokenId,
                  metadata: { name: token.name },
                  occurredAt: now,
                });
              }
              const revoked = read(tokenId);
              if (revoked === undefined) throw new Error('api_token.revoked.missing');
              return revoked;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof ApiTokenNotFound
            ? cause
            : new DatabaseError({ operation: 'revoke.api.token', cause }),
      });
    });

    return ApiTokens.of({
      list,
      create,
      authenticate,
      authorizePermission,
      revoke,
    });
  }),
);
