import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { Suppliers, SuppliersLive } from './service.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
const input = {
  displayName: ' Fournitures Exemple ',
  addressLine1: ' 1 rue du Test ',
  addressLine2: '',
  postalCode: ' 75001 ',
  city: ' Paris ',
  country: ' France ',
  email: 'BILLING@EXAMPLE.TEST',
  phone: '+33 1 23 45 67 89',
  registrationNumber: ' 123456789 ',
  vatNumber: ' fr 00 123456789 ',
  defaultCurrency: 'EUR',
  paymentTermsDays: 30,
  iban: 'fr76 3000 6000 0112 3456 7890 189',
  bic: 'agrifrpp',
};

const layer = () =>
  SuppliersLive.pipe(
    Layer.provide(AuditLive),
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '../../drizzle'),
      }),
    ),
  );

const seed = Database.use(({ sqlite }) =>
  Effect.sync(() => {
    sqlite
      .prepare(
        "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 0, 0)",
      )
      .run(actorId);
  }),
);

const run = <A, E>(effect: Effect.Effect<A, E, Suppliers | Database>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* seed;
      return yield* effect;
    }).pipe(Effect.provide(layer())),
  );

describe('Suppliers', () => {
  it('creates normalized suppliers idempotently and lists them', async () => {
    await run(
      Effect.gen(function* () {
        const suppliers = yield* Suppliers;
        const request = { ...input, requestId: randomUUID() };
        const first = yield* suppliers.create(request, actorId);
        const replay = yield* suppliers.create(request, actorId);
        expect(replay).toEqual(first);
        expect(first).toMatchObject({
          displayName: 'Fournitures Exemple',
          email: 'billing@example.test',
          vatNumber: 'FR00123456789',
          iban: 'FR7630006000011234567890189',
          bic: 'AGRIFRPP',
        });
        expect(yield* suppliers.list).toEqual([first]);
      }),
    );
  });

  it('enforces creation identity, versions, and archived state', async () => {
    await run(
      Effect.gen(function* () {
        const suppliers = yield* Suppliers;
        const request = { ...input, requestId: randomUUID() };
        const created = yield* suppliers.create(request, actorId);
        const conflict = yield* suppliers
          .create({ ...request, displayName: 'Other' }, actorId)
          .pipe(Effect.flip);
        expect(conflict._tag).toBe('SupplierCreationConflict');
        const stale = yield* suppliers
          .update(created.id, { ...input, expectedUpdatedAt: created.updatedAt - 1 }, actorId)
          .pipe(Effect.flip);
        expect(stale._tag).toBe('SupplierVersionConflict');
        const archived = yield* suppliers.archive(created.id, actorId);
        expect(archived.archived).toBe(true);
        const rejected = yield* suppliers
          .update(created.id, { ...input, expectedUpdatedAt: archived.updatedAt }, actorId)
          .pipe(Effect.flip);
        expect(rejected._tag).toBe('SupplierArchived');
        expect((yield* suppliers.reactivate(created.id, actorId)).archived).toBe(false);
      }),
    );
  });
});
