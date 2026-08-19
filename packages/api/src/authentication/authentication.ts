import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  SessionRejected,
  type AccessIdentifierValue,
  type LoginModeValue,
} from '@froment/contracts';
import { Context, Effect, Layer, Schema, Semaphore } from 'effect';

import { Database, DatabaseError } from '../database/database.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';
import { generateSession, renewIdleExpiry } from './session.js';

const CredentialLookup = Schema.Struct({ id: Schema.String, userId: Schema.String });
const SessionLookup = Schema.Struct({ id: Schema.String, absoluteExpiresAt: Schema.Number });

export interface SessionTokens {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export interface AuthenticationService {
  readonly login: (
    accessIdentifier: AccessIdentifierValue,
    mode: LoginModeValue,
  ) => Effect.Effect<
    SessionTokens,
    AuthenticationRejected | AuthenticationRateLimited | DatabaseError
  >;
  readonly sessionStatus: (
    sessionToken: string | undefined,
  ) => Effect.Effect<boolean, DatabaseError>;
  readonly logout: (
    sessionToken: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
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
    const loginSemaphore = yield* Semaphore.make(1);

    const login = Effect.fn('Authentication.login')(function* (
      accessIdentifier: AccessIdentifierValue,
      mode: LoginModeValue,
    ) {
      if (!(yield* loginSemaphore.takeIfAvailable(1))) {
        return yield* new AuthenticationRateLimited({ code: 'authentication.rate_limited' });
      }
      return yield* Effect.gen(function* () {
        const accessHmac = hmac(config.accessHmacKey, accessIdentifier);
        const credential = yield* Effect.try({
          try: () => {
            const row = database.sqlite
              .prepare(
                `select access_credentials.id, access_credentials.user_id as userId
                   from access_credentials
                   join users on users.id = access_credentials.user_id
                   where access_credentials.secret_hmac = ?
                      and access_credentials.revoked_at is null
                      and users.disabled_at is null
                      and users.kind = ?
                    limit 1`,
              )
              .get(accessHmac, mode);
            if (row === undefined) return undefined;
            return Schema.decodeUnknownSync(CredentialLookup)(row);
          },
          catch: (cause) => new DatabaseError({ operation: 'find access credential', cause }),
        });
        if (credential === undefined) {
          yield* Effect.sleep('1 second');
          return yield* new AuthenticationRejected({
            code: 'authentication.invalid_credentials',
          });
        }

        const session = generateSession(credential.userId, config.sessionHmacKey);
        yield* Effect.try({
          try: () =>
            database.sqlite.transaction(() => {
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
            })(),
          catch: (cause) => new DatabaseError({ operation: 'create login session', cause }),
        });

        return {
          sessionToken: session.sessionToken,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
        };
      }).pipe(Effect.ensuring(loginSemaphore.release(1)));
    });

    const sessionStatus = Effect.fn('Authentication.sessionStatus')(function* (
      sessionToken: string | undefined,
    ) {
      if (sessionToken === undefined) return false;
      const now = Date.now();
      const tokenHmac = hmac(config.sessionHmacKey, sessionToken);
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select sessions.id, sessions.absolute_expires_at as absoluteExpiresAt
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
          const session =
            row === undefined ? undefined : Schema.decodeUnknownSync(SessionLookup)(row);
          if (session === undefined) return false;
          database.sqlite
            .prepare('update sessions set last_seen_at = ?, idle_expires_at = ? where id = ?')
            .run(now, renewIdleExpiry(now, session.absoluteExpiresAt), session.id);
          return true;
        },
        catch: (cause) => new DatabaseError({ operation: 'validate session', cause }),
      });
    });

    const logout = Effect.fn('Authentication.logout')(function* (
      sessionToken: string | undefined,
      csrfCookie: string | undefined,
      csrfHeader: string | undefined,
    ) {
      if (
        sessionToken === undefined ||
        csrfCookie === undefined ||
        csrfHeader === undefined ||
        csrfCookie !== csrfHeader
      ) {
        return yield* new SessionRejected({ code: 'authentication.invalid_session' });
      }
      const now = Date.now();
      const tokenHmac = hmac(config.sessionHmacKey, sessionToken);
      const csrfHmac = hmac(config.sessionHmacKey, csrfHeader);
      yield* Effect.try({
        try: () =>
          database.sqlite
            .prepare(
              `update sessions set revoked_at = ?
               where token_hmac = ? and csrf_hmac = ? and revoked_at is null
                 and idle_expires_at > ? and absolute_expires_at > ?`,
            )
            .run(now, tokenHmac, csrfHmac, now, now).changes,
        catch: (cause) => new DatabaseError({ operation: 'revoke session', cause }),
      });
    });

    return Authentication.of({ login, sessionStatus, logout });
  }),
);
