import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { PasswordsLive } from '../authentication/password.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { RuntimeConfigurationDefaults } from '../runtime-config.js';
import { Clients, ClientsLive } from './clients.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const otherActorId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
const input = {
  displayName: ' Acme ',
  addressLine1: '1 rue du Test',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  email: 'contact@acme.example',
  phone: '+33 1 23 45 67 89',
};
const seed = Database.use(({ sqlite }) =>
  Effect.sync(() => {
    sqlite
      .prepare(
        "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Owner', 'administrator', 0, 0)",
      )
      .run(actorId);
    sqlite
      .prepare(
        "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Other owner', 'administrator', 0, 0)",
      )
      .run(otherActorId);
  }),
);
const layer = (filename: string) =>
  ClientsLive.pipe(
    Layer.provide(AuditLive),
    Layer.provide(PasswordsLive),
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename,
        migrationsFolder: join(import.meta.dirname, '../../drizzle'),
      }),
    ),
    Layer.provide(RuntimeConfigurationDefaults),
  );

describe('client creation idempotency', () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });
  const filename = async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-client-creation-'));
    directories.push(directory);
    return join(directory, 'database.sqlite');
  };

  it('records one client, role and audit event for concurrent retries', async () => {
    const database = await filename();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const clients = yield* Clients;
        const { sqlite } = yield* Database;
        const request = { ...input, requestId: randomUUID() };
        const results = yield* Effect.all(
          [clients.create(request, actorId), clients.create(request, actorId)],
          { concurrency: 2 },
        );
        expect(results[0]).toEqual(results[1]);
        expect(results[0]?.displayName).toBe('Acme');
        expect(sqlite.prepare('select count(*) from clients').pluck().get()).toBe(1);
        expect(sqlite.prepare('select count(*) from client_creation_requests').pluck().get()).toBe(
          1,
        );
        expect(sqlite.prepare('select count(*) from user_roles').pluck().get()).toBe(1);
        expect(
          sqlite
            .prepare("select count(*) from audit_events where action = 'client.created'")
            .pluck()
            .get(),
        ).toBe(1);
      }).pipe(Effect.provide(layer(database))),
    );
  });

  it('replays the original result after reopening the database without reverting later edits', async () => {
    const database = await filename();
    const request = { ...input, requestId: randomUUID() };
    const original = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const clients = yield* Clients;
        const result = yield* clients.create(request, actorId);
        yield* clients.update(
          result.id,
          { ...input, displayName: 'Updated', expectedUpdatedAt: result.updatedAt },
          actorId,
        );
        yield* clients.archive(result.id, actorId);
        return result;
      }).pipe(Effect.provide(layer(database))),
    );
    await Effect.runPromise(
      Effect.gen(function* () {
        const clients = yield* Clients;
        expect(yield* clients.create({ requestId: request.requestId, ...input }, actorId)).toEqual(
          original,
        );
        expect(yield* clients.get(original.id)).toMatchObject({
          displayName: 'Updated',
          archived: true,
        });
        expect(yield* clients.list).toHaveLength(1);
      }).pipe(Effect.provide(layer(database))),
    );
  });

  it('rejects reuse with another payload or actor without creating another client', async () => {
    const database = await filename();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const clients = yield* Clients;
        const request = { ...input, requestId: randomUUID() };
        yield* clients.create(request, actorId);
        for (const changed of [
          { ...request, displayName: 'Acme' },
          { ...request, email: 'another@acme.example' },
          { ...request, addressLine1: 'Another address' },
        ]) {
          expect(yield* Effect.result(clients.create(changed, actorId))).toMatchObject({
            _tag: 'Failure',
            failure: { _tag: 'ClientCreationConflict', code: 'client.creation_conflict' },
          });
        }
        expect(yield* Effect.result(clients.create(request, otherActorId))).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'ClientCreationConflict' },
        });
        expect(yield* clients.list).toHaveLength(1);
        const distinct = yield* clients.create({ ...request, requestId: randomUUID() }, actorId);
        expect(distinct.displayName).toBe('Acme');
        expect(yield* clients.list).toHaveLength(2);
      }).pipe(Effect.provide(layer(database))),
    );
  });

  it('rolls back the client and audit when saving the idempotency record fails', async () => {
    const database = await filename();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* seed;
        const clients = yield* Clients;
        const { sqlite } = yield* Database;
        const request = { ...input, requestId: randomUUID() };
        sqlite.exec(
          "create temp trigger reject_creation before insert on client_creation_requests begin select raise(abort, 'test storage failure'); end",
        );
        expect(yield* Effect.result(clients.create(request, actorId))).toMatchObject({
          _tag: 'Failure',
          failure: { _tag: 'DatabaseError' },
        });
        expect(yield* clients.list).toEqual([]);
        expect(sqlite.prepare('select count(*) from client_creation_requests').pluck().get()).toBe(
          0,
        );
        expect(sqlite.prepare('select count(*) from user_roles').pluck().get()).toBe(0);
        expect(
          sqlite
            .prepare("select count(*) from audit_events where action = 'client.created'")
            .pluck()
            .get(),
        ).toBe(0);
        sqlite.exec('drop trigger reject_creation');
        const result = yield* clients.create(request, actorId);
        expect(yield* clients.create(request, actorId)).toEqual(result);
        expect(yield* clients.list).toHaveLength(1);
      }).pipe(Effect.provide(layer(database))),
    );
  });
});
