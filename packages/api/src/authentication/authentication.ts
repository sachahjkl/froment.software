import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  SessionRejected,
  type AccessIdentifierValue,
  type LoginModeValue,
  type PermissionCodeValue,
} from '@froment/contracts';
import { Cache, Clock, Context, Effect, Layer, Ref, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';
import { generateSession, renewIdleExpiry } from './session.js';

const CredentialLookup = Schema.Struct({ id: Schema.String, userId: Schema.String });
const SessionLookup = Schema.Struct({ id: Schema.String, absoluteExpiresAt: Schema.Number });
interface LoginFailureState {
  readonly failures: number;
  readonly blockedUntil: number;
}

const initialLoginFailureState: LoginFailureState = { failures: 0, blockedUntil: 0 };

export interface SessionTokens {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export interface Principal {
  readonly userId: string;
  readonly mode: LoginModeValue;
}

export interface AuthenticationService {
  readonly login: (
    accessIdentifier: AccessIdentifierValue,
    mode: LoginModeValue,
    clientAddress: string,
  ) => Effect.Effect<
    SessionTokens,
    AuthenticationRejected | AuthenticationRateLimited | DatabaseError
  >;
  readonly sessionStatus: (
    sessionToken: string | undefined,
  ) => Effect.Effect<Principal | undefined, DatabaseError>;
  readonly authorize: (
    sessionToken: string | undefined,
    permission: PermissionCodeValue,
    requiredMode: LoginModeValue,
  ) => Effect.Effect<Principal, AuthenticationRequired | PermissionDenied | DatabaseError>;
  readonly authorizeWrite: (
    sessionToken: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
    origin: string | undefined,
    permission: PermissionCodeValue,
    requiredMode: LoginModeValue,
  ) => Effect.Effect<
    Principal,
    AuthenticationRequired | PermissionDenied | CsrfRejected | DatabaseError
  >;
  readonly logout: (
    sessionToken: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
    origin: string | undefined,
  ) => Effect.Effect<void, SessionRejected | DatabaseError>;
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
    const addressFailures = yield* Cache.make({
      capacity: 10_000,
      timeToLive: '1 hour',
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
    });
    const identifierFailures = yield* Cache.make({
      capacity: 10_000,
      timeToLive: '1 hour',
      lookup: () => Ref.make<LoginFailureState>(initialLoginFailureState),
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

    const login = Effect.fn('Authentication.login')(function* (
      accessIdentifier: AccessIdentifierValue,
      mode: LoginModeValue,
      clientAddress: string,
    ) {
      const accessHmac = hmac(config.accessHmacKey, accessIdentifier);
      const credential = yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select access_credentials.id, access_credentials.user_id as userId
                   from access_credentials
                   join users on users.id = access_credentials.user_id
                   left join clients on clients.id = users.id
                   where access_credentials.secret_hmac = ?
                      and access_credentials.revoked_at is null
                      and users.disabled_at is null
                      and users.kind = ?
                      and (users.kind <> 'client' or clients.id is not null)
                    limit 1`,
            )
            .get(accessHmac, mode);
          if (row === undefined) return undefined;
          return Schema.decodeUnknownSync(CredentialLookup)(row);
        },
        catch: (cause) => new DatabaseError({ operation: 'find access credential', cause }),
      });
      if (credential === undefined) {
        const now = yield* Clock.currentTimeMillis;
        const addressState = yield* Cache.get(addressFailures, clientAddress);
        if (!(yield* registerFailure(addressState, now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        const identifierState = yield* Cache.get(identifierFailures, accessHmac.toString('hex'));
        if (!(yield* registerFailure(identifierState, now))) {
          return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
        }
        return yield* new AuthenticationRejected({
          code: 'authentication.invalid_credentials',
        });
      }

      const now = yield* Clock.currentTimeMillis;
      yield* Ref.set(
        yield* Cache.get(identifierFailures, accessHmac.toString('hex')),
        initialLoginFailureState,
      );
      const session = generateSession(credential.userId, config.sessionHmacKey, now);
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare('update access_credentials set last_used_at = ? where id = ?')
                .run(session.now, credential.id);
              database.sqlite
                .prepare(
                  `delete from sessions
                     where user_id = ?
                       and (revoked_at is not null or idle_expires_at <= ? or absolute_expires_at <= ?)`,
                )
                .run(session.userId, session.now, session.now);
              database.sqlite
                .prepare(
                  `delete from sessions where id in (
                       select id from sessions where user_id = ?
                       order by created_at desc limit -1 offset 9
                     )`,
                )
                .run(session.userId);
              database.sqlite
                .prepare(
                  'insert into sessions (id, user_id, token_hmac, csrf_hmac, created_at, last_seen_at, idle_expires_at, absolute_expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  session.id,
                  session.userId,
                  session.tokenHmac,
                  session.csrfHmac,
                  session.now,
                  session.now,
                  session.idleExpiresAt,
                  session.expiresAt.getTime(),
                );
              audit.insert({
                action: 'authentication.login-succeeded',
                actorUserId: credential.userId,
                resourceType: 'session',
                resourceId: session.id,
                metadata: { mode },
                occurredAt: now,
              });
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'create login session', cause }),
      });

      return {
        sessionToken: session.sessionToken,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
      };
    });

    const findActiveSession = Effect.fn('Authentication.findActiveSession')(function* (
      sessionToken: string | undefined,
    ) {
      if (sessionToken === undefined) return undefined;
      const now = yield* Clock.currentTimeMillis;
      const tokenHmac = hmac(config.sessionHmacKey, sessionToken);
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select sessions.id, sessions.user_id as userId,
                      sessions.absolute_expires_at as absoluteExpiresAt,
                      users.kind as mode
               from sessions
               join users on users.id = sessions.user_id
               where sessions.token_hmac = ?
                 and sessions.revoked_at is null
                 and sessions.idle_expires_at > ?
                 and sessions.absolute_expires_at > ?
                 and users.disabled_at is null
               limit 1`,
            )
            .get(tokenHmac, now, now);
          if (row === undefined) return undefined;
          const session = Schema.decodeUnknownSync(
            Schema.Struct({
              ...SessionLookup.fields,
              userId: Schema.String,
              mode: Schema.Literals(['client', 'administrator']),
            }),
          )(row);
          database.sqlite
            .prepare('update sessions set last_seen_at = ?, idle_expires_at = ? where id = ?')
            .run(now, renewIdleExpiry(now, session.absoluteExpiresAt), session.id);
          return { userId: session.userId, mode: session.mode } satisfies Principal;
        },
        catch: (cause) => new DatabaseError({ operation: 'validate session', cause }),
      });
    });

    const sessionStatus = Effect.fn('Authentication.sessionStatus')(function* (
      sessionToken: string | undefined,
    ) {
      return yield* findActiveSession(sessionToken);
    });

    const authorize = Effect.fn('Authentication.authorize')(function* (
      sessionToken: string | undefined,
      permission: PermissionCodeValue,
      requiredMode: LoginModeValue,
    ) {
      const principal = yield* findActiveSession(sessionToken);
      if (principal === undefined) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      if (principal.mode !== requiredMode) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
      const allowed = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `select 1 from user_roles
               join role_permissions on role_permissions.role_id = user_roles.role_id
               where user_roles.user_id = ? and role_permissions.permission_code = ? limit 1`,
            )
            .get(principal.userId, permission) !== undefined,
        catch: (cause) => new DatabaseError({ operation: 'authorize permission', cause }),
      });
      if (!allowed) {
        return yield* new PermissionDenied({ code: 'authentication.permission_denied' });
      }
      return principal;
    });

    const authorizeWrite = Effect.fn('Authentication.authorizeWrite')(function* (
      sessionToken: string | undefined,
      csrfCookie: string | undefined,
      csrfHeader: string | undefined,
      origin: string | undefined,
      permission: PermissionCodeValue,
      requiredMode: LoginModeValue,
    ) {
      if (
        sessionToken === undefined ||
        csrfCookie === undefined ||
        csrfHeader === undefined ||
        csrfCookie !== csrfHeader ||
        origin !== config.publicOrigin
      ) {
        return yield* new CsrfRejected({ code: 'authentication.invalid_csrf' });
      }
      const principal = yield* authorize(sessionToken, permission, requiredMode);
      const validCsrf = yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              'select 1 from sessions where token_hmac = ? and csrf_hmac = ? and revoked_at is null limit 1',
            )
            .get(
              hmac(config.sessionHmacKey, sessionToken),
              hmac(config.sessionHmacKey, csrfHeader),
            ) !== undefined,
        catch: (cause) => new DatabaseError({ operation: 'authorize csrf token', cause }),
      });
      if (!validCsrf) {
        return yield* new CsrfRejected({ code: 'authentication.invalid_csrf' });
      }
      return principal;
    });

    const logout = Effect.fn('Authentication.logout')(function* (
      sessionToken: string | undefined,
      csrfCookie: string | undefined,
      csrfHeader: string | undefined,
      origin: string | undefined,
    ) {
      if (
        sessionToken === undefined ||
        csrfCookie === undefined ||
        csrfHeader === undefined ||
        csrfCookie !== csrfHeader ||
        origin !== config.publicOrigin
      ) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const now = yield* Clock.currentTimeMillis;
      const tokenHmac = hmac(config.sessionHmacKey, sessionToken);
      const csrfHmac = hmac(config.sessionHmacKey, csrfHeader);
      yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const row = database.sqlite
                .prepare(
                  `select id, user_id as userId from sessions
                   where token_hmac = ? and csrf_hmac = ? and revoked_at is null
                     and idle_expires_at > ? and absolute_expires_at > ?`,
                )
                .get(tokenHmac, csrfHmac, now, now);
              if (row === undefined) return;
              const session = Schema.decodeUnknownSync(
                Schema.Struct({ id: Schema.String, userId: Schema.String }),
              )(row);
              database.sqlite
                .prepare('update sessions set revoked_at = ? where id = ? and revoked_at is null')
                .run(now, session.id);
              audit.insert({
                action: 'authentication.logout',
                actorUserId: session.userId,
                resourceType: 'session',
                resourceId: session.id,
                occurredAt: now,
              });
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'revoke session', cause }),
      });
    });

    return Authentication.of({ login, sessionStatus, authorize, authorizeWrite, logout });
  }),
);
