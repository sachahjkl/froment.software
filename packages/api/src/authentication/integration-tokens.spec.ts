import { join } from 'node:path';

import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../../test/database-layer.js';
import { AuthenticationConfig } from './authentication-config.js';
import { IntegrationTokens, IntegrationTokensLive } from './integration-tokens.js';

const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const roleId = '01ARZ3NDEKTSV4RRFFQ69G5FAC';

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
    accessHmacKey: Buffer.alloc(32, 1),
    integrationTokenHmacKey: Buffer.alloc(32, 4),
    sessionHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey: Buffer.alloc(32, 3),
    publicOrigin: 'https://example.test',
  }),
);

const integrationTokensLayer = () =>
  IntegrationTokensLive.pipe(
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
    .prepare("insert into roles (id, name, created_at) values (?, 'administrator', 0)")
    .run(roleId);
  database.sqlite
    .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
    .run(userId, roleId);
  database.sqlite
    .prepare(
      "insert into role_permissions (role_id, permission_code) values (?, 'client.read'), (?, 'integration-token.manage')",
    )
    .run(roleId, roleId);
};

describe('IntegrationTokens', () => {
  it('stores only a HMAC and enforces token and owner permissions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);
        const service = yield* IntegrationTokens;
        const created = yield* service.create(
          {
            name: 'ERP principal',
            permissions: ['client.read'],
            expiresAt: 86_400_000,
          },
          userId,
        );
        const stored = database.sqlite
          .prepare('select token_hmac from integration_tokens where id = ?')
          .get(created.token.id);
        const authorized = yield* service.authenticate(created.secret);
        yield* service.authorizePermission(authorized, 'client.read');
        const missingScope = yield* Effect.result(
          service.authorizePermission(authorized, 'quote.read'),
        );
        database.sqlite
          .prepare(
            "delete from role_permissions where role_id = ? and permission_code = 'client.read'",
          )
          .run(roleId);
        const removedOwnerPermission = yield* Effect.result(
          service.authorizePermission(authorized, 'client.read'),
        );
        return {
          authorized,
          created,
          list: yield* service.list(),
          missingScope,
          removedOwnerPermission,
          stored,
        };
      }).pipe(Effect.provide(integrationTokensLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.created.secret).toMatch(/^froment_it_v1_.+\..+$/);
    expect(JSON.stringify(result.stored)).not.toContain(result.created.secret);
    expect(JSON.stringify(result.list)).not.toContain(result.created.secret);
    expect(result.authorized).toMatchObject({ userId, tokenId: result.created.token.id });
    expect(result.missingScope).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'PermissionDenied' },
    });
    expect(result.removedOwnerPermission).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'PermissionDenied' },
    });
  });

  it('rejects malformed, altered, expired, revoked, and disabled-owner tokens', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);
        const service = yield* IntegrationTokens;
        const created = yield* service.create(
          {
            name: 'ERP principal',
            permissions: ['client.read'],
            expiresAt: 1_000,
          },
          userId,
        );
        const altered = `${created.secret.slice(0, -1)}${created.secret.endsWith('A') ? 'B' : 'A'}`;
        const malformed = yield* Effect.result(service.authenticate('invalid'));
        const invalidHmac = yield* Effect.result(service.authenticate(altered));
        yield* TestClock.adjust('2 seconds');
        const expired = yield* Effect.result(service.authenticate(created.secret));

        const revocable = yield* service.create(
          {
            name: 'Accounting export',
            permissions: ['client.read'],
            expiresAt: 86_400_000,
          },
          userId,
        );
        const firstRevocation = yield* service.revoke(revocable.token.id, userId);
        const secondRevocation = yield* service.revoke(revocable.token.id, userId);
        const revoked = yield* Effect.result(service.authenticate(revocable.secret));

        const disabled = yield* service.create(
          {
            name: 'Disabled owner',
            permissions: ['client.read'],
            expiresAt: 86_400_000,
          },
          userId,
        );
        database.sqlite.prepare('update users set disabled_at = 2000 where id = ?').run(userId);
        const disabledOwner = yield* Effect.result(service.authenticate(disabled.secret));
        return {
          disabledOwner,
          expired,
          firstRevocation,
          invalidHmac,
          malformed,
          revocationAudits: database.sqlite
            .prepare("select count(*) from audit_events where action = 'integration.token-revoked'")
            .pluck()
            .get(),
          revoked,
          secondRevocation,
        };
      }).pipe(Effect.provide(integrationTokensLayer()), Effect.provide(TestClock.layer())),
    );

    for (const failure of [
      result.malformed,
      result.invalidHmac,
      result.expired,
      result.revoked,
      result.disabledOwner,
    ]) {
      expect(failure).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'AuthenticationRequired' },
      });
    }
    expect(result.firstRevocation.revokedAt).toBe(result.secondRevocation.revokedAt);
    expect(result.revocationAudits).toBe(1);
  });

  it('rejects invalid expiry, duplicate names, and permission escalation', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);
        const service = yield* IntegrationTokens;
        const invalidExpiry = yield* Effect.result(
          service.create({ name: 'Expired', permissions: ['client.read'], expiresAt: 0 }, userId),
        );
        const unique = yield* service.create(
          { name: 'Unique', permissions: ['client.read'], expiresAt: 86_400_000 },
          userId,
        );
        const duplicateName = yield* Effect.result(
          service.create(
            { name: 'Unique', permissions: ['client.read'], expiresAt: 86_400_000 },
            userId,
          ),
        );
        const escalation = yield* Effect.result(
          service.create(
            { name: 'Escalation', permissions: ['invoice.issue'], expiresAt: 86_400_000 },
            userId,
          ),
        );
        yield* service.revoke(unique.token.id, userId);
        const reusedRevokedName = yield* service.create(
          { name: 'Unique', permissions: ['client.read'], expiresAt: 86_400_000 },
          userId,
        );
        yield* service.create(
          { name: 'Expired name', permissions: ['client.read'], expiresAt: 1_000 },
          userId,
        );
        yield* TestClock.adjust('2 seconds');
        const reusedExpiredName = yield* service.create(
          { name: 'Expired name', permissions: ['client.read'], expiresAt: 86_400_000 },
          userId,
        );
        return {
          duplicateName,
          escalation,
          invalidExpiry,
          reusedExpiredName,
          reusedRevokedName,
        };
      }).pipe(Effect.provide(integrationTokensLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.invalidExpiry).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'IntegrationTokenInvalidExpiration' },
    });
    expect(result.duplicateName).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'IntegrationTokenNameConflict' },
    });
    expect(result.escalation).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'PermissionDenied' },
    });
    expect(result.reusedRevokedName.token.name).toBe('Unique');
    expect(result.reusedExpiredName.token.name).toBe('Expired name');
  });

  it('paginates token history with a stable cursor', async () => {
    const pages = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        seedAdministrator(database);
        const service = yield* IntegrationTokens;
        for (const name of ['First', 'Second', 'Third']) {
          yield* service.create(
            { name, permissions: ['client.read'], expiresAt: 86_400_000 },
            userId,
          );
          yield* TestClock.adjust(1);
        }
        const first = yield* service.list(undefined, 2);
        const second = yield* service.list(first.nextCursor ?? undefined, 2);
        return { first, second };
      }).pipe(Effect.provide(integrationTokensLayer()), Effect.provide(TestClock.layer())),
    );

    expect(pages.first.items.map(({ name }) => name)).toEqual(['Third', 'Second']);
    expect(pages.first.nextCursor).toBe(pages.first.items[1]?.id);
    expect(pages.second.items.map(({ name }) => name)).toEqual(['First']);
    expect(pages.second.nextCursor).toBeNull();
  });
});
