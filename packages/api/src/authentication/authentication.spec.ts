import { join } from 'node:path';

import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../../test/database-layer.js';
import { Authentication, AuthenticationLive } from './authentication.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const credentialId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const roleId = '01ARZ3NDEKTSV4RRFFQ69G5FAC';
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
    integrationTokenHmacKey: Buffer.alloc(32, 4),
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
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
      }),
    ),
  );

const seedAdministrator = (database: Database['Service']) => {
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
  database.sqlite
    .prepare("insert into roles (id, name, created_at) values (?, 'administrator', 0)")
    .run(roleId);
  database.sqlite
    .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
    .run(userId, roleId);
  database.sqlite
    .prepare(
      "insert into role_permissions (role_id, permission_code) values (?, 'client.read'), (?, 'client.create')",
    )
    .run(roleId, roleId);
};

describe('Authentication', () => {
  it('limits successful logins by credential across client addresses', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);

        const authentication = yield* Authentication;
        yield* Effect.forEach(
          Array.from({ length: 60 }, (_, index) => index),
          (index) => authentication.login(accessIdentifier, `192.0.2.${index}`),
          { discard: true },
        );
        const blocked = yield* Effect.result(
          authentication.login(accessIdentifier, '198.51.100.1'),
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

  it('enforces permissions, mode, CSRF, origin, and logout revocation', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(accessIdentifier, '192.0.2.1');
        const authorized = yield* authentication.authorize(
          session.sessionToken,
          ['client.read', 'client.create'],
          'administrator',
        );
        const wrongMode = yield* Effect.result(
          authentication.authorize(session.sessionToken, ['client.read'], 'client'),
        );
        const missingSession = yield* Effect.result(
          authentication.authorize(undefined, ['client.read'], 'administrator'),
        );
        const invalidCsrf = yield* Effect.result(
          authentication.authorizeCsrf(
            session.sessionToken,
            session.csrfToken,
            'different-token',
            'https://example.test',
          ),
        );
        const invalidOrigin = yield* Effect.result(
          authentication.authorizeCsrf(
            session.sessionToken,
            session.csrfToken,
            session.csrfToken,
            'https://attacker.test',
          ),
        );
        yield* authentication.authorizeCsrf(
          session.sessionToken,
          session.csrfToken,
          session.csrfToken,
          'https://example.test',
        );
        yield* authentication.logout(
          session.sessionToken,
          session.csrfToken,
          session.csrfToken,
          'https://example.test',
        );
        return {
          authorized,
          invalidCsrf,
          invalidOrigin,
          missingSession,
          revokedSession: yield* authentication.sessionStatus(session.sessionToken),
          wrongMode,
        };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.authorized).toEqual({ userId, mode: 'administrator' });
    expect(result.wrongMode).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'PermissionDenied' },
    });
    expect(result.missingSession).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AuthenticationRequired' },
    });
    expect(result.invalidCsrf).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CsrfRejected' },
    });
    expect(result.invalidOrigin).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'CsrfRejected' },
    });
    expect(result.revokedSession).toBeUndefined();
  });
});
