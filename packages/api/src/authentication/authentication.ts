import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  AuthenticationRequired,
  PermissionDenied,
  SessionRejected,
  type AccountEmailValue,
  type AccountPasswordValue,
  type LoginModeValue,
  type PermissionCodeValue,
} from '@froment/contracts';
import { Cache, Clock, Context, Effect, Layer, Ref, Schema } from 'effect';
import { randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { PasswordCredentialLookup, RefreshSessionLookup } from '../database/schema.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';
import { AccessTokens } from './paseto.js';
import { Passwords } from './password.js';

const refreshLifetime = 30 * 24 * 60 * 60 * 1_000;
const rotationGrace = 5_000;

interface LoginFailureState {
  readonly failures: number;
  readonly blockedUntil: number;
}

interface LoginQuotaState {
  readonly count: number;
  readonly startedAt: number;
}

interface PreparedSession extends AuthenticatedSession {
  readonly userId: string;
  readonly tokenHmac: Buffer;
  readonly now: number;
  readonly absoluteExpiresAt: number;
}

const initialLoginFailureState: LoginFailureState = { failures: 0, blockedUntil: 0 };

export interface AuthenticatedSession {
  readonly accessToken: string;
  readonly accessExpiresAt: number;
  readonly refreshToken: string;
  readonly refreshExpiresAt: Date;
  readonly mode: LoginModeValue;
  readonly sessionId: string;
  readonly familyId: string;
}

export interface Principal {
  readonly userId: string;
  readonly mode: LoginModeValue;
  readonly sessionId: string;
}

export interface AuthenticationService {
  readonly login: (
    email: AccountEmailValue,
    password: AccountPasswordValue,
    clientAddress: string,
  ) => Effect.Effect<
    AuthenticatedSession,
    AuthenticationRejected | AuthenticationRateLimited | DatabaseError
  >;
  readonly createSession: (
    userId: string,
    mode: LoginModeValue,
  ) => Effect.Effect<AuthenticatedSession, DatabaseError>;
  readonly refresh: (
    refreshToken: string | undefined,
  ) => Effect.Effect<AuthenticatedSession, SessionRejected | DatabaseError>;
  readonly authenticate: (
    accessToken: string | undefined,
  ) => Effect.Effect<Principal, AuthenticationRequired | DatabaseError>;
  readonly authorize: (
    accessToken: string | undefined,
    permissions: readonly [PermissionCodeValue, ...ReadonlyArray<PermissionCodeValue>],
    requiredMode: LoginModeValue,
  ) => Effect.Effect<Principal, AuthenticationRequired | PermissionDenied | DatabaseError>;
  readonly logout: (
    refreshToken: string | undefined,
  ) => Effect.Effect<void, SessionRejected | DatabaseError>;
  readonly revokeUserSessions: (userId: string) => Effect.Effect<void, DatabaseError>;
}

export class Authentication extends Context.Service<Authentication, AuthenticationService>()(
  '@froment/api/Authentication',
) {}

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;
    const audit = yield* Audit;
    const passwords = yield* Passwords;
    const accessTokens = yield* AccessTokens;
    const addressFailures = yield* Cache.make({
      capacity: 10_000,
      timeToLive: '1 hour',
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
    });
    const accountFailures = yield* Cache.make({
      capacity: 10_000,
      timeToLive: '1 hour',
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
    });
    const successfulLogins = yield* Cache.make({
      capacity: 20_000,
      timeToLive: '2 minutes',
      lookup: () =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((startedAt) => Ref.make<LoginQuotaState>({ count: 0, startedAt })),
        ),
    });

    const consumeLoginQuota = Effect.fn('Authentication.consumeLoginQuota')(function* (
      key: string,
      now: number,
    ) {
      const state = yield* Cache.get(successfulLogins, key);
      return yield* Ref.modify(state, (current): readonly [boolean, LoginQuotaState] => {
        if (now - current.startedAt >= 60_000) return [true, { count: 1, startedAt: now }];
        if (current.count >= 60) return [false, current];
        return [true, { ...current, count: current.count + 1 }];
      });
    });

    const registerFailure = Effect.fn('Authentication.registerFailure')(function* (
      state: Ref.Ref<LoginFailureState>,
      now: number,
    ) {
      return yield* Ref.modify(state, (current) => {
        if (now < current.blockedUntil) return [false, current];
        const failures = current.failures + 1;
        const delay = Math.min(15 * 60 * 1_000, 1_000 * 2 ** Math.min(failures - 1, 10));
        return [true, { failures, blockedUntil: now + delay }];
      });
    });

    const prepareSession = Effect.fn('Authentication.prepareSession')(function* (
      userId: string,
      mode: LoginModeValue,
      familyId: string,
      absoluteExpiresAt: number,
      now: number,
    ) {
      const sessionId = ulid(now);
      const refreshToken = randomBytes(32).toString('base64url');
      const access = yield* accessTokens.issue({ userId, sessionId, mode });
      return {
        accessToken: access.accessToken,
        accessExpiresAt: access.expiresAt,
        refreshToken,
        refreshExpiresAt: new Date(absoluteExpiresAt),
        mode,
        userId,
        sessionId,
        familyId,
        tokenHmac: hmac(config.refreshHmacKey, refreshToken),
        now,
        absoluteExpiresAt,
      };
    });

    const insertSession = (session: PreparedSession) =>
      database.sqlite
        .prepare(
          `insert into refresh_sessions
             (id, family_id, user_id, token_hmac, created_at, rotated_at, absolute_expires_at)
           values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          session.sessionId,
          session.familyId,
          session.userId,
          session.tokenHmac,
          session.now,
          session.now,
          session.absoluteExpiresAt,
        );

    const createSession = Effect.fn('Authentication.createSession')(function* (
      userId: string,
      mode: LoginModeValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const session = yield* prepareSession(userId, mode, ulid(now), now + refreshLifetime, now);
      yield* Effect.try({
        try: () => insertSession(session),
        catch: (cause) => new DatabaseError({ operation: 'create refresh session', cause }),
      });
      return session;
    });

    const login = Effect.fn('Authentication.login')(function* (
      email: AccountEmailValue,
      password: AccountPasswordValue,
      clientAddress: string,
    ) {
      const normalizedEmail = email.trim().toLowerCase();
      const accountKey = hmac(config.refreshHmacKey, normalizedEmail).toString('hex');
      const credential = yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select password_credentials.user_id as userId,
                      password_credentials.password_hash as passwordHash,
                      users.kind as mode
                 from password_credentials
                 join users on users.id = password_credentials.user_id
                 left join clients on clients.id = users.id
                where password_credentials.email = ?
                  and users.disabled_at is null
                  and (users.kind <> 'client' or clients.id is not null)
                limit 1`,
            )
            .get(normalizedEmail);
          return row === undefined
            ? undefined
            : Schema.decodeUnknownSync(PasswordCredentialLookup)(row);
        },
        catch: (cause) => new DatabaseError({ operation: 'find password credential', cause }),
      });
      const passwordAccepted = yield* passwords.verify(
        credential?.passwordHash ??
          '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      );
      if (credential === undefined || !passwordAccepted) {
        const now = yield* Clock.currentTimeMillis;
        if (!(yield* registerFailure(yield* Cache.get(addressFailures, clientAddress), now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        if (!(yield* registerFailure(yield* Cache.get(accountFailures, accountKey), now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        return yield* new AuthenticationRejected({ code: 'authentication.invalid_credentials' });
      }

      const now = yield* Clock.currentTimeMillis;
      if (
        !(yield* consumeLoginQuota(`address:${clientAddress}`, now)) ||
        !(yield* consumeLoginQuota(`account:${accountKey}`, now))
      ) {
        return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
      }
      yield* Ref.set(yield* Cache.get(accountFailures, accountKey), initialLoginFailureState);
      const session = yield* prepareSession(
        credential.userId,
        credential.mode,
        ulid(now),
        now + refreshLifetime,
        now,
      );
      yield* Effect.try({
        try: () => {
          database.sqlite
            .transaction(() => {
              insertSession(session);
              audit.insert({
                action: 'authentication.login-succeeded',
                actorUserId: credential.userId,
                resourceType: 'session',
                resourceId: session.familyId,
                metadata: { mode: credential.mode },
                occurredAt: now,
              });
            })
            .immediate();
        },
        catch: (cause) => new DatabaseError({ operation: 'create login session', cause }),
      });
      return session;
    });

    const refresh = Effect.fn('Authentication.refresh')(function* (
      refreshToken: string | undefined,
    ) {
      if (refreshToken === undefined || refreshToken.length !== 43) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const now = yield* Clock.currentTimeMillis;
      const row = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select refresh_sessions.id, refresh_sessions.family_id as familyId,
                      refresh_sessions.user_id as userId, users.kind as mode,
                      refresh_sessions.created_at as createdAt,
                      refresh_sessions.absolute_expires_at as absoluteExpiresAt,
                      refresh_sessions.consumed_at as consumedAt,
                      refresh_sessions.revoked_at as revokedAt,
                      users.disabled_at as disabledAt,
                      password_credentials.password_changed_at as passwordChangedAt
                 from refresh_sessions
                 join users on users.id = refresh_sessions.user_id
                 join password_credentials on password_credentials.user_id = users.id
                where refresh_sessions.token_hmac = ? limit 1`,
            )
            .get(hmac(config.refreshHmacKey, refreshToken)),
        catch: (cause) => new DatabaseError({ operation: 'find refresh session', cause }),
      });
      if (row === undefined) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const current = Schema.decodeUnknownSync(RefreshSessionLookup)(row);
      const invalidAccount =
        current.revokedAt !== null ||
        current.disabledAt !== null ||
        current.absoluteExpiresAt <= now ||
        current.passwordChangedAt > current.createdAt;
      const replayed = current.consumedAt !== null && now - current.consumedAt > rotationGrace;
      if (invalidAccount || replayed) {
        yield* Effect.try({
          try: () =>
            database.sqlite
              .prepare(
                'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where family_id = ?',
              )
              .run(now, current.familyId),
          catch: (cause) => new DatabaseError({ operation: 'revoke refresh family', cause }),
        });
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }

      const next = yield* prepareSession(
        current.userId,
        current.mode,
        current.familyId,
        current.absoluteExpiresAt,
        now,
      );
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              if (current.consumedAt === null) {
                const consumed = database.sqlite
                  .prepare(
                    'update refresh_sessions set consumed_at = ?, rotated_at = ? where id = ? and consumed_at is null and revoked_at is null',
                  )
                  .run(now, now, current.id).changes;
                if (consumed !== 1) {
                  const state = database.sqlite
                    .prepare(
                      'select consumed_at as consumedAt, revoked_at as revokedAt from refresh_sessions where id = ?',
                    )
                    .get(current.id);
                  const decoded = Schema.decodeUnknownSync(
                    Schema.Struct({
                      consumedAt: Schema.NullOr(Schema.Int),
                      revokedAt: Schema.NullOr(Schema.Int),
                    }),
                  )(state);
                  if (
                    decoded.revokedAt !== null ||
                    decoded.consumedAt === null ||
                    now - decoded.consumedAt > rotationGrace
                  ) {
                    throw new SessionRejected({ code: 'authentication.invalid_session' });
                  }
                }
              }
              insertSession(next);
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof SessionRejected
            ? cause
            : new DatabaseError({ operation: 'rotate refresh session', cause }),
      });
      return next;
    });

    const authenticate = Effect.fn('Authentication.authenticate')(function* (
      accessToken: string | undefined,
    ) {
      if (accessToken === undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      const claims = yield* accessTokens.verify(accessToken);
      const row = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare('select kind as mode from users where id = ? and disabled_at is null')
            .get(claims.userId),
        catch: (cause) => new DatabaseError({ operation: 'authenticate access token', cause }),
      });
      if (row === undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      const mode = Schema.decodeUnknownSync(
        Schema.Struct({ mode: Schema.Literals(['client', 'administrator']) }),
      )(row).mode;
      if (mode !== claims.mode) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return { userId: claims.userId, sessionId: claims.sessionId, mode };
    });

    const authorize = Effect.fn('Authentication.authorize')(function* (
      accessToken: string | undefined,
      permissions: readonly [PermissionCodeValue, ...ReadonlyArray<PermissionCodeValue>],
      requiredMode: LoginModeValue,
    ) {
      const principal = yield* authenticate(accessToken);
      if (principal.mode !== requiredMode) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
      const count = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select count(distinct role_permissions.permission_code) from user_roles
               join role_permissions on role_permissions.role_id = user_roles.role_id
               where user_roles.user_id = ?
                 and role_permissions.permission_code in (${permissions.map(() => '?').join(', ')})`,
            )
            .pluck()
            .get(principal.userId, ...permissions),
        catch: (cause) => new DatabaseError({ operation: 'authorize permission', cause }),
      });
      if (count !== permissions.length) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
      return principal;
    });

    const logout = Effect.fn('Authentication.logout')(function* (refreshToken: string | undefined) {
      if (refreshToken === undefined || refreshToken.length !== 43) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const now = yield* Clock.currentTimeMillis;
      const changed = yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  'select family_id as familyId, user_id as userId from refresh_sessions where token_hmac = ? limit 1',
                )
                .get(hmac(config.refreshHmacKey, refreshToken));
              if (row === undefined) return 0;
              const session = Schema.decodeUnknownSync(
                Schema.Struct({ familyId: Schema.String, userId: Schema.String }),
              )(row);
              const changes = database.sqlite
                .prepare(
                  'update refresh_sessions set revoked_at = ? where family_id = ? and revoked_at is null',
                )
                .run(now, session.familyId).changes;
              if (changes === 0) return 0;
              audit.insert({
                action: 'authentication.logout',
                actorUserId: session.userId,
                resourceType: 'session',
                resourceId: session.familyId,
                occurredAt: now,
              });
              return changes;
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'logout refresh session', cause }),
      });
      if (changed === 0) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
    });

    const revokeUserSessions = Effect.fn('Authentication.revokeUserSessions')(function* (
      userId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where user_id = ?',
            )
            .run(now, userId),
        catch: (cause) => new DatabaseError({ operation: 'revoke user sessions', cause }),
      });
    });

    return Authentication.of({
      login,
      createSession,
      refresh,
      authenticate,
      authorize,
      logout,
      revokeUserSessions,
    });
  }),
);
