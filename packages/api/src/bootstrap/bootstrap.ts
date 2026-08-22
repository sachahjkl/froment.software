import {
  BootstrapRejected,
  BootstrapRateLimited,
  BootstrapUnavailable,
  Ulid,
  type BootstrapRequestValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema, Semaphore } from 'effect';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { ulid } from 'ulid';

import { AuthenticationConfig } from '../authentication/authentication-config.js';
import { Authentication, type AuthenticatedSession } from '../authentication/authentication.js';
import { Passwords } from '../authentication/password.js';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { RuntimeConfiguration } from '../runtime-config.js';

export const verifyBootstrapPassword = Effect.fn('verifyBootstrapPassword')(function* (
  password: string,
  expected: AuthenticationConfig['Service']['bootstrapPasswordHash'],
  maximumMemoryBytes: number,
) {
  const actual = yield* Effect.callback<Buffer>((resume) => {
    scrypt(
      password,
      expected.salt,
      expected.hash.byteLength,
      {
        N: expected.cost,
        r: expected.blockSize,
        p: expected.parallelization,
        maxmem: maximumMemoryBytes,
      },
      (error, derivedKey) =>
        resume(error === null ? Effect.succeed(derivedKey) : Effect.die(error)),
    );
  });
  return timingSafeEqual(actual, expected.hash);
});

export interface BootstrapSession extends AuthenticatedSession {
  readonly email: string;
}

export interface BootstrapService {
  readonly isAvailable: Effect.Effect<boolean, DatabaseError>;
  readonly create: (
    request: BootstrapRequestValue,
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
    const runtime = yield* RuntimeConfiguration;
    const audit = yield* Audit;
    const passwords = yield* Passwords;
    const authentication = yield* Authentication;
    const attemptSemaphore = yield* Semaphore.make(runtime.authentication.bootstrapConcurrency);
    let failedAttempts = 0;
    let blockedUntil = 0;

    const isAvailable = Effect.try({
      try: () =>
        database.sqlite
          .prepare(
            `select 1 from password_credentials
             join users on users.id = password_credentials.user_id
             where users.kind = 'administrator' limit 1`,
          )
          .get() === undefined,
      catch: (cause) => new DatabaseError({ operation: 'check.bootstrap.availability', cause }),
    });

    const create = Effect.fn('Bootstrap.create')(function* (request: BootstrapRequestValue) {
      if (!(yield* attemptSemaphore.takeIfAvailable(1))) {
        return yield* new BootstrapRateLimited({ code: 'bootstrap.rate_limited' });
      }
      return yield* Effect.gen(function* () {
        if (!(yield* isAvailable)) {
          return yield* new BootstrapUnavailable({ code: 'bootstrap.unavailable' });
        }
        const now = yield* Clock.currentTimeMillis;
        if (now < blockedUntil) {
          return yield* new BootstrapRateLimited({ code: 'bootstrap.rate_limited' });
        }
        if (
          !(yield* verifyBootstrapPassword(
            request.bootstrapPassword,
            config.bootstrapPasswordHash,
            runtime.authentication.bootstrapScryptMaximumMemoryBytes,
          ))
        ) {
          failedAttempts += 1;
          const delay = Math.min(
            runtime.authentication.failureMaximumDelayMillis,
            runtime.authentication.failureBaseDelayMillis *
              2 ** Math.min(failedAttempts - 1, runtime.authentication.failureExponentLimit),
          );
          blockedUntil = now + delay;
          return yield* new BootstrapRejected({ code: 'bootstrap.invalid_credentials' });
        }
        failedAttempts = 0;
        blockedUntil = 0;
        const email = request.email.trim().toLowerCase();
        const passwordHash = yield* passwords.hash(request.password).pipe(Effect.orDie);

        const existingAdministrator = Schema.decodeUnknownSync(Schema.UndefinedOr(Ulid))(
          database.sqlite
            .prepare(
              "select id from users where kind = 'administrator' order by created_at limit 1",
            )
            .pluck()
            .get(),
        );
        const administratorId = existingAdministrator ?? ulid();
        const roleId = ulid();

        yield* Effect.try({
          try: () =>
            database.sqlite
              .transaction(() => {
                const administrator = database.sqlite
                  .prepare(
                    `select 1 from password_credentials
                     join users on users.id = password_credentials.user_id
                     where users.kind = 'administrator' limit 1`,
                  )
                  .get();
                if (administrator !== undefined) {
                  throw new BootstrapUnavailable({ code: 'bootstrap.unavailable' });
                }

                if (existingAdministrator === undefined) {
                  database.sqlite
                    .prepare(
                      'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
                    )
                    .run(administratorId, 'Administrator', 'administrator', now, now);
                  database.sqlite
                    .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
                    .run(roleId, 'administrator', now);
                  database.sqlite
                    .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
                    .run(administratorId, roleId);
                  database.sqlite
                    .prepare(
                      'insert into role_permissions (role_id, permission_code) select ?, code from permissions',
                    )
                    .run(roleId);
                }
                database.sqlite
                  .prepare(
                    'insert into password_credentials (user_id, email, password_hash, created_at, updated_at, password_changed_at) values (?, ?, ?, ?, ?, ?)',
                  )
                  .run(administratorId, email, passwordHash, now, now, now);
                audit.insert({
                  action: 'administrator.bootstrapped',
                  actorUserId: null,
                  resourceType: 'user',
                  resourceId: administratorId,
                  metadata: existingAdministrator === undefined ? { roleId } : {},
                  occurredAt: now,
                });
              })
              .immediate(),
          catch: (cause) => {
            if (cause instanceof BootstrapUnavailable) return cause;
            return new DatabaseError({ operation: 'create.administrator.bootstrap', cause });
          },
        });

        const session = yield* authentication
          .createSession(administratorId, 'administrator')
          .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        return { email, ...session };
      }).pipe(Effect.ensuring(attemptSemaphore.release(1)));
    });

    return Bootstrap.of({ isAvailable, create });
  }),
);
