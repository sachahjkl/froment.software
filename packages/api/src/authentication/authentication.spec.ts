import { join } from 'node:path';

import { Deferred, Effect, Fiber, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import {
  defaultRuntimeConfig,
  RuntimeConfiguration,
  type RuntimeConfigValue,
} from '../runtime-config.js';
import { Authentication, AuthenticationLive } from './authentication.js';
import { AccessTokensLive } from './paseto.js';
import { Passwords, PasswordsLive } from './password.js';
import { AuthenticationConfig } from './authentication-config.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const roleId = '01ARZ3NDEKTSV4RRFFQ69G5FAC';
const email = 'administrator@example.test';
const password = 'correct horse battery staple';

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
    pasetoSecretKey:
      'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA',
    pasetoPublicKey: 'k4.public.nLs-Lm0nP2S86EJThJ6foAzKXYxYE8KdJhxvCz9kLhQ',
    apiTokenHmacKey: Buffer.alloc(32, 4),
    refreshHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey: Buffer.alloc(32, 3),
    publicOrigin: 'https://example.test',
  }),
);

const authenticationLayer = (
  passwordLayer: Layer.Layer<Passwords> = PasswordsLive,
  runtime: RuntimeConfigValue = defaultRuntimeConfig,
) =>
  AuthenticationLive.pipe(
    Layer.provideMerge(AccessTokensLive),
    Layer.provideMerge(passwordLayer),
    Layer.provide(AuditLive),
    Layer.provide(configLayer),
    Layer.provide(Layer.succeed(RuntimeConfiguration, runtime)),
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
      }),
    ),
  );

const seedAdministrator = Effect.fn('seedAdministrator')(function* (database: Database['Service']) {
  const passwordHash = yield* (yield* Passwords).hash(password);
  database.sqlite
    .prepare(
      "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 0, 0)",
    )
    .run(userId);
  database.sqlite
    .prepare(
      'insert into password_credentials (user_id, email, password_hash, created_at, updated_at, password_changed_at) values (?, ?, ?, 0, 0, 0)',
    )
    .run(userId, email, passwordHash);
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
});

describe('Authentication', () => {
  it('refuses exhausted login quotas before password verification', async () => {
    let calls = 0;
    const passwords = Layer.succeed(
      Passwords,
      Passwords.of({
        hash: () => Effect.succeed('$argon2id$fixture'),
        verify: () =>
          Effect.sync(() => {
            calls += 1;
            return true;
          }),
      }),
    );
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedAdministrator(yield* Database);
        const authentication = yield* Authentication;
        for (let index = 0; index < 2; index++) {
          yield* authentication.login(email, password, '192.0.2.1');
        }
        for (let index = 0; index < 10; index++) {
          expect(
            yield* Effect.result(authentication.login(email, password, '192.0.2.1')),
          ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'AuthenticationRateLimited' } });
        }
        expect(calls).toBe(2);
        yield* TestClock.adjust('1 minute');
        yield* authentication.login(email, password, '192.0.2.1');
        expect(calls).toBe(3);
      }).pipe(
        Effect.provide(
          authenticationLayer(passwords, {
            ...defaultRuntimeConfig,
            authentication: {
              ...defaultRuntimeConfig.authentication,
              loginAttemptsPerMinute: 2,
              loginQuotaCapacity: 2,
            },
          }),
        ),
        Effect.provide(TestClock.layer()),
      ),
    );
  });

  it('reserves concurrent anonymous attempts before any verification completes', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const release = yield* Deferred.make<void>();
        let calls = 0;
        const passwords = Layer.succeed(
          Passwords,
          Passwords.of({
            hash: () => Effect.die('unexpected.hash'),
            verify: Effect.fn('controlledVerify')(function* () {
              calls += 1;
              if (calls === 2) yield* Deferred.succeed(started, undefined);
              yield* Deferred.await(release);
              return false;
            }),
          }),
        );
        yield* Effect.gen(function* () {
          const authentication = yield* Authentication;
          const attempt = Effect.result(authentication.login(email, password, '192.0.2.1'));
          const pending = yield* Effect.forkChild(
            Effect.all([attempt, attempt], { concurrency: 'unbounded' }),
          );
          yield* Deferred.await(started);
          const refused = yield* Effect.all(
            Array.from({ length: 6 }, () => attempt),
            { concurrency: 'unbounded' },
          );
          expect(refused).toHaveLength(6);
          for (const result of refused)
            expect(result).toMatchObject({
              _tag: 'Failure',
              failure: { _tag: 'AuthenticationRateLimited' },
            });
          expect(calls).toBe(2);
          yield* Deferred.succeed(release, undefined);
          yield* Fiber.join(pending);
        }).pipe(
          Effect.provide(
            authenticationLayer(passwords, {
              ...defaultRuntimeConfig,
              authentication: {
                ...defaultRuntimeConfig.authentication,
                loginAttemptsPerMinute: 2,
                loginQuotaCapacity: 2,
              },
            }),
          ),
        );
      }).pipe(Effect.provide(TestClock.layer())),
    );
  });

  it('reads effective permissions from current roles and uses them for authorization', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        expect((yield* authentication.authenticate(session.accessToken)).permissions).toEqual([
          'client.create',
          'client.read',
        ]);
        database.sqlite
          .prepare(
            "delete from role_permissions where role_id = ? and permission_code = 'client.create'",
          )
          .run(roleId);
        expect((yield* authentication.authenticate(session.accessToken)).permissions).toEqual([
          'client.read',
        ]);
        expect(
          (yield* authentication.authorize(session.accessToken, ['client.read'], 'administrator'))
            .permissions,
        ).toEqual(['client.read']);
        expect(
          yield* Effect.result(
            authentication.authorize(session.accessToken, ['client.create'], 'administrator'),
          ),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'PermissionDenied' } });
        database.sqlite.prepare('delete from user_roles where user_id = ?').run(userId);
        expect((yield* authentication.authenticate(session.accessToken)).permissions).toEqual([]);
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );
  });
  it('lists session families and revokes another family without closing the current one', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const first = yield* authentication.login(email, password, '192.0.2.1');
        const second = yield* authentication.login(email, password, '192.0.2.2');
        const rotated = yield* authentication.refresh(second.refreshToken);
        const principal = yield* authentication.authenticate(first.accessToken);
        const sessions = yield* authentication.listSessions(principal);
        expect(sessions).toHaveLength(2);
        expect(sessions[0]).toMatchObject({ id: first.familyId, current: true });
        expect(sessions[1]).toMatchObject({ id: second.familyId, current: false });
        expect(JSON.stringify(sessions)).not.toContain(second.refreshToken);
        expect(
          yield* Effect.result(authentication.revokeSession(principal, first.familyId)),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'AccountSessionCurrent' } });
        const otherUser = '01ARZ3NDEKTSV4RRFFQ69G5FAD';
        database.sqlite
          .prepare(
            "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Other', 'administrator', 0, 0)",
          )
          .run(otherUser);
        const other = yield* authentication.createSession(otherUser, 'administrator');
        expect(
          yield* Effect.result(authentication.revokeSession(principal, other.familyId)),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'AccountSessionNotFound' } });
        yield* authentication.revokeSession(principal, second.familyId);
        yield* authentication.revokeSession(principal, second.familyId);
        expect(yield* authentication.listSessions(principal)).toHaveLength(1);
        expect(yield* Effect.result(authentication.authenticate(second.accessToken))).toMatchObject(
          { _tag: 'Failure' },
        );
        expect(
          yield* Effect.result(authentication.authenticate(rotated.accessToken)),
        ).toMatchObject({ _tag: 'Failure' });
        expect(yield* Effect.result(authentication.refresh(rotated.refreshToken))).toMatchObject({
          _tag: 'Failure',
        });
        expect((yield* authentication.authenticate(first.accessToken)).userId).toBe(userId);
        expect(
          database.sqlite
            .prepare(
              "select count(*) from audit_events where action = 'authentication.session-revoked'",
            )
            .pluck()
            .get(),
        ).toBe(1);
        yield* TestClock.adjust('31 days');
        expect(yield* authentication.listSessions(principal)).toHaveLength(0);
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );
  });
  it('allows only one concurrent password change for the same credential', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        const principal = yield* authentication.authenticate(session.accessToken);
        const results = yield* Effect.all(
          ['first replacement password', 'second replacement password'].map((newPassword) =>
            Effect.result(
              authentication.changePassword(principal, { currentPassword: password, newPassword }),
            ),
          ),
          { concurrency: 'unbounded' },
        );
        expect(results.filter((result) => result._tag === 'Success')).toHaveLength(1);
        expect(results.filter((result) => result._tag === 'Failure')).toHaveLength(1);
        expect(
          database.sqlite
            .prepare(
              "select count(*) from audit_events where action = 'authentication.password-changed'",
            )
            .pluck()
            .get(),
        ).toBe(1);
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );
  });
  it('changes a password, rejects stale requests and revokes every browser session', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const first = yield* authentication.login(email, password, '192.0.2.1');
        const second = yield* authentication.login(email, password, '192.0.2.2');
        const principal = yield* authentication.authenticate(first.accessToken);
        const newPassword = 'a different correct passphrase';
        expect(
          yield* Effect.result(
            authentication.changePassword(principal, {
              currentPassword: 'wrong password value',
              newPassword,
            }),
          ),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'PasswordChangeRejected' } });
        expect(
          yield* Effect.result(
            authentication.changePassword(principal, {
              currentPassword: password,
              newPassword: password,
            }),
          ),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'PasswordChangeRejected' } });
        expect(
          yield* Effect.result(
            authentication.changePassword(principal, {
              currentPassword: password,
              newPassword: 'short',
            }),
          ),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'PasswordChangeRejected' } });
        expect((yield* authentication.authenticate(second.accessToken)).userId).toBe(userId);
        yield* authentication.changePassword(principal, { currentPassword: password, newPassword });
        for (const session of [first, second]) {
          expect(
            yield* Effect.result(authentication.authenticate(session.accessToken)),
          ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'AuthenticationRequired' } });
          expect(yield* Effect.result(authentication.refresh(session.refreshToken))).toMatchObject({
            _tag: 'Failure',
            failure: { _tag: 'SessionRejected' },
          });
        }
        expect(
          yield* Effect.result(
            authentication.changePassword(principal, {
              currentPassword: newPassword,
              newPassword: password,
            }),
          ),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'PasswordChangeRejected' } });
        expect((yield* authentication.login(email, newPassword, '192.0.2.3')).mode).toBe(
          'administrator',
        );
        expect(
          yield* Effect.result(authentication.login(email, password, '192.0.2.4')),
        ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'AuthenticationRejected' } });
        const audit = database.sqlite
          .prepare(
            "select metadata from audit_events where action = 'authentication.password-changed'",
          )
          .all();
        expect(audit).toHaveLength(1);
        expect(JSON.stringify(audit)).not.toContain(password);
        expect(JSON.stringify(audit)).not.toContain(newPassword);
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );
  });
  it('limits successful logins by credential across client addresses', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);

        const authentication = yield* Authentication;
        yield* Effect.forEach(
          Array.from({ length: 60 }, (_, index) => index),
          (index) => authentication.login(email, password, `192.0.2.${index}`),
          { discard: true },
        );
        const blocked = yield* Effect.result(authentication.login(email, password, '198.51.100.1'));
        return {
          blocked,
          audits: database.sqlite
            .prepare(
              "select count(*) from audit_events where action = 'authentication.login-succeeded'",
            )
            .pluck()
            .get(),
          sessions: database.sqlite.prepare('select count(*) from refresh_sessions').pluck().get(),
        };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.blocked).toMatchObject({ _tag: 'Failure' });
    expect(result.audits).toBe(60);
    expect(result.sessions).toBe(60);
  });

  it('enforces permissions, rotates refresh tokens, and revokes a refresh family', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        const authorized = yield* authentication.authorize(
          session.accessToken,
          ['client.read', 'client.create'],
          'administrator',
        );
        const wrongMode = yield* Effect.result(
          authentication.authorize(session.accessToken, ['client.read'], 'client'),
        );
        const missingSession = yield* Effect.result(
          authentication.authorize(undefined, ['client.read'], 'administrator'),
        );
        const rotated = yield* authentication.refresh(session.refreshToken);
        yield* authentication.logout(rotated.refreshToken);
        return {
          authorized,
          missingSession,
          revokedRefresh: yield* Effect.result(authentication.refresh(rotated.refreshToken)),
          accessAfterLogout: yield* Effect.result(authentication.authenticate(session.accessToken)),
          wrongMode,
        };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.authorized).toMatchObject({ userId, mode: 'administrator' });
    expect(result.wrongMode).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'PermissionDenied' },
    });
    expect(result.missingSession).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AuthenticationRequired' },
    });
    expect(result.revokedRefresh).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'SessionRejected' },
    });
    expect(result.accessAfterLogout).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AuthenticationRequired' },
    });
  });

  it('allows concurrent rotation, then revokes the family after replay grace', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        const concurrent = yield* Effect.all(
          [
            authentication.refresh(session.refreshToken),
            authentication.refresh(session.refreshToken),
          ],
          { concurrency: 'unbounded' },
        );
        const rotated = concurrent.find((candidate) => candidate.refreshToken !== undefined);
        if (rotated?.refreshToken === undefined) return yield* Effect.die('Missing rotated token');
        yield* TestClock.adjust('6 seconds');
        const replay = yield* Effect.result(authentication.refresh(session.refreshToken));
        const family = yield* Effect.result(authentication.refresh(rotated.refreshToken));
        const sessionCount = database.sqlite
          .prepare('select count(*) from refresh_sessions where family_id = ?')
          .pluck()
          .get(session.familyId);
        const replayAuditCount = database.sqlite
          .prepare(
            `select count(*) from audit_events
             where action = 'authentication.refresh-replay-detected' and resource_id = ?`,
          )
          .pluck()
          .get(session.familyId);
        return { concurrent, family, replay, replayAuditCount, sessionCount };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.concurrent).toHaveLength(2);
    expect(result.concurrent[0].familyId).toBe(result.concurrent[1].familyId);
    expect(
      result.concurrent.filter((candidate) => candidate.refreshToken !== undefined),
    ).toHaveLength(1);
    expect(result.sessionCount).toBe(2);
    expect(result.replayAuditCount).toBe(1);
    expect(result.replay).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'SessionRejected' },
    });
    expect(result.family).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'SessionRejected' },
    });
  });

  it('rejects expired, disabled, and password-invalidated refresh sessions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;

        const expired = yield* authentication.login(email, password, '192.0.2.1');
        database.sqlite
          .prepare('update refresh_sessions set absolute_expires_at = ? where id = ?')
          .run(2_000_000_000_001, expired.sessionId);
        yield* TestClock.adjust(2);
        const expiredResult = yield* Effect.result(authentication.refresh(expired.refreshToken));

        const disabled = yield* authentication.login(email, password, '192.0.2.2');
        database.sqlite
          .prepare('update users set disabled_at = ? where id = ?')
          .run(2_000_000_000_003, userId);
        const disabledResult = yield* Effect.result(authentication.refresh(disabled.refreshToken));
        database.sqlite.prepare('update users set disabled_at = null where id = ?').run(userId);

        const changed = yield* authentication.login(email, password, '192.0.2.3');
        database.sqlite
          .prepare(
            'update password_credentials set updated_at = ?, password_changed_at = ? where user_id = ?',
          )
          .run(2_000_000_000_004, 2_000_000_000_004, userId);
        const changedResult = yield* Effect.result(authentication.refresh(changed.refreshToken));
        return { changedResult, disabledResult, expiredResult };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    for (const rejected of [result.expiredResult, result.disabledResult, result.changedResult]) {
      expect(rejected).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'SessionRejected' },
      });
    }
  });

  it('rolls back refresh consumption when replacement insertion fails', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        database.sqlite.exec(`create trigger reject_refresh_insert
          before insert on refresh_sessions
          when new.family_id = '${session.familyId}'
          begin select raise(abort, 'test replacement failure'); end`);
        const failed = yield* Effect.result(authentication.refresh(session.refreshToken));
        const consumedAt = database.sqlite
          .prepare('select consumed_at from refresh_sessions where id = ?')
          .pluck()
          .get(session.sessionId);
        database.sqlite.exec('drop trigger reject_refresh_insert');
        const retried = yield* authentication.refresh(session.refreshToken);
        return { consumedAt, failed, retried };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.failed).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'DatabaseError' },
    });
    expect(result.consumedAt).toBeNull();
    expect(result.retried.familyId).toBeDefined();
  });

  it('does not leave an active session when refresh races with logout', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const session = yield* authentication.login(email, password, '192.0.2.1');
        const [refresh] = yield* Effect.all(
          [
            Effect.result(authentication.refresh(session.refreshToken)),
            authentication.logout(session.refreshToken),
          ],
          { concurrency: 'unbounded' },
        );
        const activeSessions = database.sqlite
          .prepare(
            'select count(*) from refresh_sessions where family_id = ? and revoked_at is null',
          )
          .pluck()
          .get(session.familyId);
        const replacement =
          refresh._tag === 'Success' && refresh.success.refreshToken !== undefined
            ? yield* Effect.result(authentication.refresh(refresh.success.refreshToken))
            : undefined;
        return { activeSessions, replacement };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.activeSessions).toBe(0);
    if (result.replacement !== undefined) {
      expect(result.replacement).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'SessionRejected' },
      });
    }
  });

  it('rejects invalid credentials, malformed tokens, and revoked user sessions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const database = yield* Database;
        yield* seedAdministrator(database);
        const authentication = yield* Authentication;
        const invalidLogin = yield* Effect.result(
          authentication.login('unknown@example.test', password, '192.0.2.1'),
        );
        const limitedLogin = yield* Effect.result(
          authentication.login('unknown@example.test', password, '192.0.2.1'),
        );
        const session = yield* authentication.login(email, password, '192.0.2.2');
        yield* authentication.revokeUserSessions(userId, userId);
        const revoked = yield* Effect.result(authentication.refresh(session.refreshToken));
        const missingAccess = yield* Effect.result(authentication.authenticate(undefined));
        const malformedAccess = yield* Effect.result(authentication.authenticate('invalid'));
        const malformedRefresh = yield* Effect.result(authentication.refresh('invalid'));
        const malformedLogout = yield* Effect.result(authentication.logout('invalid'));
        const unknownLogout = yield* Effect.result(authentication.logout('A'.repeat(43)));
        database.sqlite.prepare("update users set kind = 'client' where id = ?").run(userId);
        const changedMode = yield* Effect.result(authentication.authenticate(session.accessToken));
        const revocationAuditCount = database.sqlite
          .prepare(
            `select count(*) from audit_events
             where action = 'authentication.sessions-revoked' and resource_id = ?`,
          )
          .pluck()
          .get(userId);
        return {
          changedMode,
          invalidLogin,
          limitedLogin,
          malformedAccess,
          malformedLogout,
          malformedRefresh,
          missingAccess,
          revocationAuditCount,
          revoked,
          unknownLogout,
        };
      }).pipe(Effect.provide(authenticationLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.invalidLogin).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AuthenticationRejected' },
    });
    expect(result.revocationAuditCount).toBe(1);
    expect(result.limitedLogin).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'AuthenticationRateLimited' },
    });
    for (const rejected of [
      result.changedMode,
      result.malformedAccess,
      result.missingAccess,
      result.malformedLogout,
      result.malformedRefresh,
      result.revoked,
      result.unknownLogout,
    ]) {
      expect(rejected).toMatchObject({ _tag: 'Failure' });
    }
  });
});
