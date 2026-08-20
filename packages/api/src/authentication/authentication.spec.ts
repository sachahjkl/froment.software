import { join } from 'node:path';

import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { Database, makeDatabaseLayer } from '../database/database.js';
import { Authentication, AuthenticationLive } from './authentication.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const credentialId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const accessIdentifier = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const accessHmacKey = Buffer.alloc(32, 1);

const configLayer = Layer.succeed(
  AuthenticationConfig,
  AuthenticationConfig.of({
    bootstrapPasswordHash: {
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
      salt: Buffer.alloc(16),
      hash: Buffer.alloc(64),
    },
    accessHmacKey,
    sessionHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey: Buffer.alloc(32, 3),
    publicOrigin: 'https://example.test',
  }),
);

const authenticationLayer = () =>
  AuthenticationLive.pipe(
    Layer.provide(AuditLive),
    Layer.provide(configLayer),
    Layer.provideMerge(
      makeDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
      }),
    ),
  );

describe('Authentication', () => {
  it('limits successful logins by credential across client addresses', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        database.sqlite
          .prepare(
            "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 0, 0)",
          )
          .run(userId);
        database.sqlite
          .prepare(
            'insert into access_credentials (id, user_id, secret_hmac, created_at) values (?, ?, ?, 0)',
          )
          .run(credentialId, userId, hmac(accessHmacKey, accessIdentifier));

        const authentication = yield* Authentication;
        yield* Effect.forEach(
          Array.from({ length: 60 }, (_, index) => index),
          (index) => authentication.login(accessIdentifier, 'administrator', `192.0.2.${index}`),
          { discard: true },
        );
        const blocked = yield* Effect.result(
          authentication.login(accessIdentifier, 'administrator', '198.51.100.1'),
        );
        return {
          blocked,
          audits: database.sqlite
            .prepare(
              "select count(*) from audit_events where action = 'authentication.login-succeeded'",
            )
            .pluck()
            .get(),
          sessions: database.sqlite.prepare('select count(*) from sessions').pluck().get(),
        };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.blocked).toMatchObject({ _tag: 'Failure' });
    expect(result.audits).toBe(60);
    expect(result.sessions).toBe(10);
  });
});
