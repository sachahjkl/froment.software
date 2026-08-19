import {
  BootstrapRejected,
  BootstrapRateLimited,
  BootstrapUnavailable,
  type BootstrapResultValue,
} from '@froment/contracts';
import { Context, Effect, Layer, Semaphore } from 'effect';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';

import { AuthenticationConfig, hmac } from '../authentication/authentication-config.js';
import { generateSession } from '../authentication/session.js';
import { Database, DatabaseError } from '../database/database.js';

export interface BootstrapSession extends BootstrapResultValue {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}

export interface BootstrapService {
  readonly isAvailable: Effect.Effect<boolean, DatabaseError>;
  readonly create: (
    password: string,
  ) => Effect.Effect<
    BootstrapSession,
    BootstrapRejected | BootstrapUnavailable | BootstrapRateLimited | DatabaseError
  >;
}

export class Bootstrap extends Context.Service<Bootstrap, BootstrapService>()(
  '@froment/api/Bootstrap',
) {}

export const BootstrapLive = Layer.effect(
  Bootstrap,
  Effect.gen(function* () {
    const database = yield* Database;
    const config = yield* AuthenticationConfig;
    const attemptSemaphore = yield* Semaphore.make(1);
    let failedAttempts = 0;
    let blockedUntil = 0;

    const isAvailable = Effect.try({
      try: () =>
        database.sqlite
          .prepare("select 1 from users where kind = 'administrator' limit 1")
          .get() === undefined,
      catch: (cause) => new DatabaseError({ operation: 'check bootstrap availability', cause }),
    });

    const create = Effect.fn('Bootstrap.create')(function* (password: string) {
      if (!(yield* attemptSemaphore.takeIfAvailable(1))) {
        return yield* new BootstrapRateLimited({ code: 'bootstrap.rate_limited' });
      }
      return yield* Effect.gen(function* () {
        if (!(yield* isAvailable)) {
          return yield* new BootstrapUnavailable({ code: 'bootstrap.unavailable' });
        }
        const now = Date.now();
        if (now < blockedUntil) {
          return yield* new BootstrapRateLimited({ code: 'bootstrap.rate_limited' });
        }
        const actualHash = createHash('sha512').update(password, 'utf8').digest();
        if (!timingSafeEqual(actualHash, config.bootstrapPasswordHash)) {
          failedAttempts += 1;
          const delay = Math.min(15 * 60 * 1_000, 1_000 * 2 ** Math.min(failedAttempts - 1, 10));
          blockedUntil = now + delay;
          return yield* new BootstrapRejected({ code: 'bootstrap.invalid_credentials' });
        }
        failedAttempts = 0;
        blockedUntil = 0;

        const administratorId = ulid();
        const roleId = ulid();
        const credentialId = ulid();
        const accessIdentifier = randomBytes(32).toString('base64url');
        const session = generateSession(administratorId, config.sessionHmacKey);

        yield* Effect.try({
          try: () =>
            database.sqlite
              .transaction(() => {
                const administrator = database.sqlite
                  .prepare("select 1 from users where kind = 'administrator' limit 1")
                  .get();
                if (administrator !== undefined) {
                  throw new BootstrapUnavailable({ code: 'bootstrap.unavailable' });
                }

                database.sqlite
                  .prepare(
                    'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
                  )
                  .run(administratorId, 'Administrator', 'administrator', session.now, session.now);
                database.sqlite
                  .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
                  .run(roleId, 'administrator', session.now);
                database.sqlite
                  .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
                  .run(administratorId, roleId);
                database.sqlite
                  .prepare(
                    'insert into role_permissions (role_id, permission_code) select ?, code from permissions',
                  )
                  .run(roleId);
                database.sqlite
                  .prepare(
                    'insert into access_credentials (id, user_id, secret_hmac, created_at) values (?, ?, ?, ?)',
                  )
                  .run(
                    credentialId,
                    administratorId,
                    hmac(config.accessHmacKey, accessIdentifier),
                    session.now,
                  );
                database.sqlite
                  .prepare(
                    'insert into sessions (id, user_id, token_hmac, csrf_hmac, created_at, last_seen_at, idle_expires_at, absolute_expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
                  )
                  .run(
                    session.id,
                    administratorId,
                    session.tokenHmac,
                    session.csrfHmac,
                    session.now,
                    session.now,
                    session.idleExpiresAt,
                    session.expiresAt.getTime(),
                  );
              })
              .immediate(),
          catch: (cause) => {
            if (cause instanceof BootstrapUnavailable) return cause;
            return new DatabaseError({ operation: 'create administrator bootstrap', cause });
          },
        });

        return {
          administratorId,
          accessIdentifier,
          sessionToken: session.sessionToken,
          csrfToken: session.csrfToken,
          expiresAt: session.expiresAt,
        };
      }).pipe(Effect.ensuring(attemptSemaphore.release(1)));
    });

    return Bootstrap.of({ isAvailable, create });
  }),
);
