import {
  AccountEmail,
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
import { RuntimeConfiguration } from '../runtime-config.js';

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

export interface RefreshedSession extends Omit<AuthenticatedSession, 'refreshToken'> {
  readonly refreshToken: string | undefined;
}

export interface Principal {
  readonly userId: string;
  readonly email: AccountEmailValue;
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
  ) => Effect.Effect<RefreshedSession, SessionRejected | DatabaseError>;
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
  readonly revokeUserSessions: (
    userId: string,
    actorUserId: string,
  ) => Effect.Effect<void, DatabaseError>;
}

export class Authentication extends Context.Service<Authentication, AuthenticationService>()(
  '@froment/api/Authentication',
) {}

export const AuthenticationLive = Layer.effect(
  Authentication,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;
    const runtime = yield* RuntimeConfiguration;
    const audit = yield* Audit;
    const passwords = yield* Passwords;
    const accessTokens = yield* AccessTokens;
    const addressFailures = yield* Cache.make({
      capacity: runtime.authentication.failureCacheCapacity,
      timeToLive: runtime.authentication.failureCacheLifetimeMillis,
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
    });
    const accountFailures = yield* Cache.make({
      capacity: runtime.authentication.failureCacheCapacity,
      timeToLive: runtime.authentication.failureCacheLifetimeMillis,
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
    });
    const successfulLogins = yield* Cache.make({
      capacity: runtime.authentication.successfulLoginCacheCapacity,
      timeToLive: runtime.authentication.successfulLoginCacheLifetimeMillis,
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
        if (now - current.startedAt >= runtime.authentication.quotaWindowMillis) {
          return [true, { count: 1, startedAt: now }];
        }
        if (current.count >= runtime.authentication.successfulLoginsPerMinute)
          return [false, current];
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
        const delay = Math.min(
          runtime.authentication.failureMaximumDelayMillis,
          runtime.authentication.failureBaseDelayMillis *
            2 ** Math.min(failures - 1, runtime.authentication.failureExponentLimit),
        );
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

    const cleanupExpiredSessions = (now: number) =>
      database.sqlite
        .prepare(
          `delete from refresh_sessions where id in (
             select id from refresh_sessions
              where absolute_expires_at <= ?
              order by absolute_expires_at
               limit ?
           )`,
        )
        .run(now, runtime.authentication.expiredSessionCleanupLimit);

    const createSession = Effect.fn('Authentication.createSession')(function* (
      userId: string,
      mode: LoginModeValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const session = yield* prepareSession(
        userId,
        mode,
        ulid(now),
        now + runtime.authentication.refreshSessionLifetimeMillis,
        now,
      );
      yield* Effect.try({
        try: () => {
          cleanupExpiredSessions(now);
          insertSession(session);
        },
        catch: (cause) => new DatabaseError({ operation: 'create.refresh.session', cause }),
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
      const now = yield* Clock.currentTimeMillis;
      const addressFailureState = yield* Cache.get(addressFailures, clientAddress);
      const accountFailureState = yield* Cache.get(accountFailures, accountKey);
      if (
        now < (yield* Ref.get(addressFailureState)).blockedUntil ||
        now < (yield* Ref.get(accountFailureState)).blockedUntil
      ) {
        return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
      }
      const credential = yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select password_credentials.user_id as userId,
                      password_credentials.password_hash as passwordHash,
                      users.kind as mode
                  from password_credentials
                  join users on users.id = password_credentials.user_id
                  left join client_access_accounts on client_access_accounts.user_id = users.id
                  left join users as client_users on client_users.id = client_access_accounts.client_id
                 where password_credentials.email = ?
                   and users.disabled_at is null
                   and (
                     users.kind <> 'client'
                     or (client_access_accounts.user_id is not null and client_users.disabled_at is null)
                   )
                 limit 1`,
            )
            .get(normalizedEmail);
          return row === undefined
            ? undefined
            : Schema.decodeUnknownSync(PasswordCredentialLookup)(row);
        },
        catch: (cause) => new DatabaseError({ operation: 'find.password.credential', cause }),
      });
      const passwordAccepted = yield* passwords.verify(
        credential?.passwordHash ??
          '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        password,
      );
      if (credential === undefined || !passwordAccepted) {
        if (!(yield* registerFailure(addressFailureState, now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        if (!(yield* registerFailure(accountFailureState, now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        return yield* new AuthenticationRejected({ code: 'authentication.invalid_credentials' });
      }

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
        now + runtime.authentication.refreshSessionLifetimeMillis,
        now,
      );
      yield* Effect.try({
        try: () => {
          database.sqlite
            .transaction(() => {
              cleanupExpiredSessions(now);
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
        catch: (cause) => new DatabaseError({ operation: 'create.login.session', cause }),
      });
      return session;
    });

    const findRefreshSession = (tokenHmac: Buffer) => {
      const row = database.sqlite
        .prepare(
          `select refresh_sessions.id, refresh_sessions.family_id as familyId,
                  refresh_sessions.user_id as userId, users.kind as mode,
                  refresh_sessions.created_at as createdAt,
                  refresh_sessions.absolute_expires_at as absoluteExpiresAt,
                  refresh_sessions.consumed_at as consumedAt,
                  refresh_sessions.replacement_session_id as replacementSessionId,
                  refresh_sessions.revoked_at as revokedAt,
                  users.disabled_at as disabledAt,
                  password_credentials.password_changed_at as passwordChangedAt
             from refresh_sessions
              join users on users.id = refresh_sessions.user_id
              join password_credentials on password_credentials.user_id = users.id
              left join client_access_accounts on client_access_accounts.user_id = users.id
              left join users as client_users on client_users.id = client_access_accounts.client_id
             where refresh_sessions.token_hmac = ?
               and (
                 users.kind <> 'client'
                 or (client_access_accounts.user_id is not null and client_users.disabled_at is null)
               )
             limit 1`,
        )
        .get(tokenHmac);
      return row === undefined ? undefined : Schema.decodeUnknownSync(RefreshSessionLookup)(row);
    };

    const refresh = Effect.fn('Authentication.refresh')(function* (
      refreshToken: string | undefined,
    ) {
      if (refreshToken === undefined || refreshToken.length !== 43) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const now = yield* Clock.currentTimeMillis;
      const tokenHmac = hmac(config.refreshHmacKey, refreshToken);
      const replacementSessionId = ulid(now);
      const replacementToken = randomBytes(32).toString('base64url');
      const replacementTokenHmac = hmac(config.refreshHmacKey, replacementToken);
      const rotation = yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(
              ():
                | {
                    readonly kind: 'concurrent';
                    readonly sessionId: string;
                    readonly familyId: string;
                    readonly userId: string;
                    readonly mode: LoginModeValue;
                    readonly absoluteExpiresAt: number;
                    readonly refreshToken: undefined;
                  }
                | {
                    readonly kind: 'rotated';
                    readonly sessionId: string;
                    readonly familyId: string;
                    readonly userId: string;
                    readonly mode: LoginModeValue;
                    readonly absoluteExpiresAt: number;
                    readonly refreshToken: string;
                  }
                | { readonly kind: 'rejected' } => {
                const fresh = findRefreshSession(tokenHmac);
                if (fresh === undefined) return { kind: 'rejected' };
                const invalidAccount =
                  fresh.revokedAt !== null ||
                  fresh.disabledAt !== null ||
                  fresh.absoluteExpiresAt <= now ||
                  fresh.passwordChangedAt > fresh.createdAt;
                if (invalidAccount) {
                  database.sqlite
                    .prepare(
                      'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where family_id = ?',
                    )
                    .run(now, fresh.familyId);
                  return { kind: 'rejected' };
                }
                if (fresh.consumedAt !== null) {
                  if (
                    now - fresh.consumedAt > runtime.authentication.refreshRotationGraceMillis ||
                    fresh.replacementSessionId === null
                  ) {
                    database.sqlite
                      .prepare(
                        'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where family_id = ?',
                      )
                      .run(now, fresh.familyId);
                    audit.insert({
                      action: 'authentication.refresh-replay-detected',
                      actorUserId: fresh.userId,
                      resourceType: 'session',
                      resourceId: fresh.familyId,
                      metadata: { sessionId: fresh.id },
                      occurredAt: now,
                    });
                    return { kind: 'rejected' };
                  }
                  const replacement = database.sqlite
                    .prepare(
                      `select id from refresh_sessions
                      where id = ? and family_id = ? and user_id = ? and revoked_at is null`,
                    )
                    .get(fresh.replacementSessionId, fresh.familyId, fresh.userId);
                  if (replacement === undefined) return { kind: 'rejected' };
                  return {
                    kind: 'concurrent',
                    sessionId: fresh.replacementSessionId,
                    familyId: fresh.familyId,
                    userId: fresh.userId,
                    mode: fresh.mode,
                    absoluteExpiresAt: fresh.absoluteExpiresAt,
                    refreshToken: undefined,
                  };
                }
                const consumed = database.sqlite
                  .prepare(
                    `update refresh_sessions
                      set consumed_at = ?, rotated_at = ?, replacement_session_id = ?
                    where id = ? and consumed_at is null and revoked_at is null`,
                  )
                  .run(now, now, replacementSessionId, fresh.id).changes;
                if (consumed !== 1) return { kind: 'rejected' };
                database.sqlite
                  .prepare(
                    `insert into refresh_sessions
                     (id, family_id, user_id, token_hmac, created_at, rotated_at, absolute_expires_at)
                   values (?, ?, ?, ?, ?, ?, ?)`,
                  )
                  .run(
                    replacementSessionId,
                    fresh.familyId,
                    fresh.userId,
                    replacementTokenHmac,
                    now,
                    now,
                    fresh.absoluteExpiresAt,
                  );
                return {
                  kind: 'rotated',
                  sessionId: replacementSessionId,
                  familyId: fresh.familyId,
                  userId: fresh.userId,
                  mode: fresh.mode,
                  absoluteExpiresAt: fresh.absoluteExpiresAt,
                  refreshToken: replacementToken,
                };
              },
            )
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'rotate.refresh.session', cause }),
      });
      if (rotation.kind === 'rejected') {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const access = yield* accessTokens.issue({
        userId: rotation.userId,
        sessionId: rotation.sessionId,
        mode: rotation.mode,
      });
      return {
        accessToken: access.accessToken,
        accessExpiresAt: access.expiresAt,
        refreshToken: rotation.refreshToken,
        refreshExpiresAt: new Date(rotation.absoluteExpiresAt),
        mode: rotation.mode,
        sessionId: rotation.sessionId,
        familyId: rotation.familyId,
      };
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
            .prepare(
              `select users.kind as mode, password_credentials.email
               from users
               join password_credentials on password_credentials.user_id = users.id
                left join client_access_accounts on client_access_accounts.user_id = users.id
                left join users as client_users on client_users.id = client_access_accounts.client_id
               where users.id = ? and users.disabled_at is null
                 and (
                   users.kind <> 'client'
                   or (client_access_accounts.user_id is not null and client_users.disabled_at is null)
                 )`,
            )
            .get(claims.userId),
        catch: (cause) => new DatabaseError({ operation: 'authenticate.access.token', cause }),
      });
      if (row === undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      const account = Schema.decodeUnknownSync(
        Schema.Struct({ email: AccountEmail, mode: Schema.Literals(['client', 'administrator']) }),
      )(row);
      const mode = account.mode;
      if (mode !== claims.mode) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return {
        userId: claims.userId,
        email: account.email,
        sessionId: claims.sessionId,
        mode,
      };
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
        catch: (cause) => new DatabaseError({ operation: 'authorize.permission', cause }),
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
        catch: (cause) => new DatabaseError({ operation: 'logout.refresh.session', cause }),
      });
      if (changed === 0) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
    });

    const revokeUserSessions = Effect.fn('Authentication.revokeUserSessions')(function* (
      userId: string,
      actorUserId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () => {
          const changes = database.sqlite
            .prepare(
              'update refresh_sessions set revoked_at = coalesce(revoked_at, ?) where user_id = ?',
            )
            .run(now, userId).changes;
          if (changes > 0) {
            audit.insert({
              action: 'authentication.sessions-revoked',
              actorUserId,
              resourceType: 'user',
              resourceId: userId,
              metadata: { count: String(changes) },
              occurredAt: now,
            });
          }
        },
        catch: (cause) => new DatabaseError({ operation: 'revoke.user.sessions', cause }),
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
