import {
  AuthenticationRequired,
  IntegrationToken as IntegrationTokenSchema,
  IntegrationTokenInvalidExpiration,
  IntegrationTokenNameConflict,
  IntegrationTokenNotFound,
  IntegrationTokenSecret,
  IntegrationPermissionCode,
  PermissionDenied,
  Ulid,
  type IntegrationPermissionCodeValue,
  type IntegrationTokenCreateRequestValue,
  type IntegrationTokenCreatedValue,
  type IntegrationTokenPageValue,
  type IntegrationTokenValue,
  type PermissionCodeValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Option, Schema } from 'effect';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError, isSqliteError } from '../database/database.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';

const maximumLifetime = 365 * 24 * 60 * 60 * 1_000;
const defaultRateLimit = 120;
const tokenPrefix = 'froment_it_v1_';

const IntegrationTokenRecord = Schema.Struct({
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

export interface IntegrationPrincipal {
  readonly userId: UlidValue;
  readonly tokenId: UlidValue;
  readonly rateLimitPerMinute: number;
}

export interface IntegrationTokensService {
  readonly list: (
    cursor?: UlidValue,
    limit?: number,
  ) => Effect.Effect<IntegrationTokenPageValue, DatabaseError>;
  readonly create: (
    request: IntegrationTokenCreateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    IntegrationTokenCreatedValue,
    | IntegrationTokenInvalidExpiration
    | IntegrationTokenNameConflict
    | PermissionDenied
    | DatabaseError
  >;
  readonly authenticate: (
    token: string,
  ) => Effect.Effect<IntegrationPrincipal, AuthenticationRequired | DatabaseError>;
  readonly authorizePermission: (
    principal: IntegrationPrincipal,
    permission: PermissionCodeValue,
  ) => Effect.Effect<void, PermissionDenied | DatabaseError>;
  readonly revoke: (
    tokenId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<IntegrationTokenValue, IntegrationTokenNotFound | DatabaseError>;
}

export class IntegrationTokens extends Context.Service<
  IntegrationTokens,
  IntegrationTokensService
>()('@froment/api/IntegrationTokens') {}

export const IntegrationTokensLive = Layer.effect(
  IntegrationTokens,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;
    const audit = yield* Audit;

    const permissions = (tokenId: string): ReadonlyArray<IntegrationPermissionCodeValue> =>
      Schema.decodeUnknownSync(Schema.Array(IntegrationPermissionCode))(
        database.sqlite
          .prepare(
            `select permission_code from integration_token_permissions
             where token_id = ? order by permission_code`,
          )
          .pluck()
          .all(tokenId),
      );

    const read = (tokenId: string): IntegrationTokenValue | undefined => {
      const row = database.sqlite
        .prepare(
          `select id, name, created_at as createdAt, expires_at as expiresAt,
                  last_used_at as lastUsedAt, revoked_at as revokedAt,
                  rate_limit_per_minute as rateLimitPerMinute
             from integration_tokens where id = ?`,
        )
        .get(tokenId);
      if (row === undefined) return undefined;
      return Schema.decodeUnknownSync(IntegrationTokenSchema)({
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

    const IntegrationTokenListRow = Schema.Struct({
      id: Ulid,
      name: Schema.String,
      createdAt: Schema.Number,
      expiresAt: Schema.Number,
      lastUsedAt: Schema.NullOr(Schema.Number),
      revokedAt: Schema.NullOr(Schema.Number),
      rateLimitPerMinute: Schema.Number,
      permissions: Schema.String,
    });
    const decodePermissions = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Array(IntegrationPermissionCode)),
    );

    const list = Effect.fn('IntegrationTokens.list')(function* (cursor?: UlidValue, limit = 50) {
      return yield* Effect.try({
        try: () => {
          const rows = Schema.decodeUnknownSync(Schema.Array(IntegrationTokenListRow))(
            database.sqlite
              .prepare(
                `select integration_tokens.id, integration_tokens.name,
                        integration_tokens.created_at as createdAt,
                        integration_tokens.expires_at as expiresAt,
                        integration_tokens.last_used_at as lastUsedAt,
                        integration_tokens.revoked_at as revokedAt,
                        integration_tokens.rate_limit_per_minute as rateLimitPerMinute,
                        coalesce((
                          select json_group_array(permission_code)
                            from (
                              select permission_code
                                from integration_token_permissions
                               where token_id = integration_tokens.id
                               order by permission_code
                            )
                        ), '[]') as permissions
                   from integration_tokens
                  where (? is null
                     or integration_tokens.created_at < (
                          select cursor.created_at from integration_tokens as cursor where cursor.id = ?
                        )
                     or (integration_tokens.created_at = (
                          select cursor.created_at from integration_tokens as cursor where cursor.id = ?
                        ) and integration_tokens.id < ?))
                  order by integration_tokens.created_at desc, integration_tokens.id desc
                  limit ?`,
              )
              .all(cursor ?? null, cursor ?? null, cursor ?? null, cursor ?? null, limit + 1),
          );
          const hasMore = rows.length > limit;
          const items = rows.slice(0, limit).map(({ permissions: encodedPermissions, ...row }) =>
            Schema.decodeUnknownSync(IntegrationTokenSchema)({
              ...row,
              permissions: decodePermissions(encodedPermissions),
            }),
          );
          return {
            items,
            nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
          } satisfies IntegrationTokenPageValue;
        },
        catch: (cause) => new DatabaseError({ operation: 'list integration tokens', cause }),
      });
    });

    const create = Effect.fn('IntegrationTokens.create')(function* (
      request: IntegrationTokenCreateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      if (request.expiresAt <= now || request.expiresAt > now + maximumLifetime) {
        return yield* new IntegrationTokenInvalidExpiration({
          code: 'integration_token.invalid_expiration',
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
        catch: (cause) =>
          new DatabaseError({ operation: 'read integration token permissions', cause }),
      });
      if (requestedPermissions.some((permission) => !allowedPermissions.has(permission))) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }

      const tokenId = Schema.decodeUnknownSync(Ulid)(ulid(now));
      const secret = `${tokenPrefix}${tokenId}.${randomBytes(32).toString('base64url')}`;
      const name = request.name.trim();
      const rateLimitPerMinute = request.rateLimitPerMinute ?? defaultRateLimit;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare(
                  `insert into integration_tokens
                   (id, user_id, name, token_hmac, created_at, expires_at, rate_limit_per_minute)
                   values (?, ?, ?, ?, ?, ?, ?)`,
                )
                .run(
                  tokenId,
                  actorUserId,
                  name,
                  hmac(config.integrationTokenHmacKey, secret),
                  now,
                  request.expiresAt,
                  rateLimitPerMinute,
                );
              const insertPermission = database.sqlite.prepare(
                `insert into integration_token_permissions (token_id, permission_code)
                 values (?, ?)`,
              );
              for (const permission of requestedPermissions) {
                insertPermission.run(tokenId, permission);
              }
              audit.insert({
                action: 'integration.token-created',
                actorUserId,
                resourceType: 'integration-token',
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
              if (token === undefined) throw new Error('Created integration token is missing.');
              return Schema.decodeUnknownSync(
                Schema.Struct({ token: IntegrationTokenSchema, secret: IntegrationTokenSecret }),
              )({ token, secret });
            })
            .immediate(),
        catch: (cause) =>
          isSqliteError(cause, 'SQLITE_CONSTRAINT_TRIGGER')
            ? new IntegrationTokenNameConflict({ code: 'integration_token.name_conflict' })
            : new DatabaseError({ operation: 'create integration token', cause }),
      });
    });

    const authenticate = Effect.fn('IntegrationTokens.authenticate')(function* (candidate: string) {
      const decoded = Schema.decodeUnknownOption(IntegrationTokenSecret)(candidate);
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
              `select integration_tokens.id, integration_tokens.user_id as userId,
                      integration_tokens.name, integration_tokens.token_hmac as tokenHmac,
                      integration_tokens.created_at as createdAt,
                      integration_tokens.expires_at as expiresAt,
                      integration_tokens.last_used_at as lastUsedAt,
                      integration_tokens.revoked_at as revokedAt,
                      integration_tokens.rate_limit_per_minute as rateLimitPerMinute
                 from integration_tokens
                 join users on users.id = integration_tokens.user_id
                where integration_tokens.id = ?
                  and users.kind = 'administrator'
                  and users.disabled_at is null
                limit 1`,
            )
            .get(tokenId);
          return row === undefined
            ? undefined
            : Schema.decodeUnknownSync(IntegrationTokenRecord)(row);
        },
        catch: (cause) => new DatabaseError({ operation: 'read integration token', cause }),
      });
      const candidateHmac = hmac(config.integrationTokenHmacKey, candidate);
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
              `update integration_tokens set last_used_at = ?
               where id = ? and (last_used_at is null or last_used_at <= ?)`,
            )
            .run(now, record.id, now - 60_000),
        catch: (cause) => new DatabaseError({ operation: 'update integration token use', cause }),
      });
      return {
        userId: record.userId,
        tokenId: record.id,
        rateLimitPerMinute: record.rateLimitPerMinute,
      };
    });

    const authorizePermission = Effect.fn('IntegrationTokens.authorizePermission')(function* (
      principal: IntegrationPrincipal,
      permission: PermissionCodeValue,
    ) {
      const allowed = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select 1
                 from integration_token_permissions
                 join user_roles on user_roles.user_id = ?
                 join role_permissions
                   on role_permissions.role_id = user_roles.role_id
                  and role_permissions.permission_code = integration_token_permissions.permission_code
                where integration_token_permissions.token_id = ?
                  and integration_token_permissions.permission_code = ?
                limit 1`,
            )
            .get(principal.userId, principal.tokenId, permission) !== undefined,
        catch: (cause) =>
          new DatabaseError({ operation: 'authorize integration token permission', cause }),
      });
      if (!allowed) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
    });

    const revoke = Effect.fn('IntegrationTokens.revoke')(function* (
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
                throw new IntegrationTokenNotFound({ code: 'integration_token.not_found' });
              }
              if (token.revokedAt === null) {
                database.sqlite
                  .prepare(
                    `update integration_tokens set revoked_at = ?, revoked_by_user_id = ?
                     where id = ? and revoked_at is null`,
                  )
                  .run(now, actorUserId, tokenId);
                audit.insert({
                  action: 'integration.token-revoked',
                  actorUserId,
                  resourceType: 'integration-token',
                  resourceId: tokenId,
                  metadata: { name: token.name },
                  occurredAt: now,
                });
              }
              const revoked = read(tokenId);
              if (revoked === undefined) throw new Error('Revoked integration token is missing.');
              return revoked;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof IntegrationTokenNotFound
            ? cause
            : new DatabaseError({ operation: 'revoke integration token', cause }),
      });
    });

    return IntegrationTokens.of({
      list,
      create,
      authenticate,
      authorizePermission,
      revoke,
    });
  }),
);
