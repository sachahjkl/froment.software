import { join } from 'node:path';

import { ConfigProvider, Effect, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { Database } from '../database/database.js';
import { RuntimeConfigurationLive } from '../runtime-config.js';
import { Audit, AuditLive } from './audit.js';
import { AuditReader, AuditReaderLive } from './reader.js';

const readerLayer = (config: { readonly AUDIT_PAGE_SIZE?: string } = {}) =>
  Layer.merge(AuditLive, AuditReaderLive).pipe(
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '..', '..', 'drizzle'),
      }),
    ),
    Layer.provide(
      RuntimeConfigurationLive.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(config))),
      ),
    ),
  );

const seedEvents = Effect.fn('seedAuditEvents')(function* (count: number, sameTime = false) {
  const audit = yield* Audit;
  return Array.from({ length: count }, (_, index) =>
    audit.insert({
      action: index % 2 === 0 ? 'quote.created' : 'invoice.created',
      actorUserId: null,
      resourceType: index % 2 === 0 ? 'quote' : 'invoice',
      resourceId: `resource-${index}`,
      occurredAt: 1_788_000_000_000 + (sameTime ? 0 : index),
      metadata: { detail: 'Excluded audit detail' },
    }),
  )
    .sort()
    .reverse();
});

describe('AuditReader', () => {
  it.each([2, 75])(
    'uses configured page size %i for both pagination directions',
    async (pageSize) => {
      await Effect.gen(function* () {
        const ids = yield* seedEvents(pageSize * 2 + 1);
        const reader = yield* AuditReader;
        const first = yield* reader.list({});
        expect(first.items.map(({ id }) => id)).toEqual(ids.slice(0, pageSize));
        expect(first.previousCursor).toBeNull();
        expect(first.nextCursor).toBe(ids[pageSize - 1]);
        if (first.nextCursor === null) throw new Error('Missing configured next cursor');
        const second = yield* reader.list({ cursor: first.nextCursor });
        expect(second.items.map(({ id }) => id)).toEqual(ids.slice(pageSize, pageSize * 2));
        if (second.previousCursor === null || second.nextCursor === null) {
          throw new Error('Missing configured page cursors');
        }
        expect(yield* reader.list({ cursor: second.previousCursor, direction: 'newer' })).toEqual(
          first,
        );
        const last = yield* reader.list({ cursor: second.nextCursor });
        expect(last.items.map(({ id }) => id)).toEqual(ids.slice(pageSize * 2));
        expect(last.nextCursor).toBeNull();
        expect((yield* reader.list({ limit: 1 })).items).toHaveLength(1);
        expect((yield* reader.list({ limit: pageSize })).items).toHaveLength(pageSize);
        const prepare = vi.spyOn((yield* Database).sqlite, 'prepare');
        const failure = yield* reader.list({ limit: pageSize + 1 }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: 'InvalidAuditQuery', code: 'audit.invalid_query' });
        expect(prepare).not.toHaveBeenCalled();
        prepare.mockRestore();
      }).pipe(
        Effect.provide(readerLayer({ AUDIT_PAGE_SIZE: String(pageSize) })),
        Effect.runPromise,
      );
    },
  );

  it('bounds pages and navigates both ways without duplicating boundary events', async () => {
    await Effect.gen(function* () {
      const ids = yield* seedEvents(121);
      const reader = yield* AuditReader;
      const first = yield* reader.list({});
      expect(first.items.map(({ id }) => id)).toEqual(ids.slice(0, 50));
      expect(first.previousCursor).toBeNull();
      expect(first.nextCursor).toBe(ids[49]);
      if (first.nextCursor === null) throw new Error('Missing next cursor');

      const second = yield* reader.list({ cursor: first.nextCursor });
      expect(second.items.map(({ id }) => id)).toEqual(ids.slice(50, 100));
      expect(second.previousCursor).toBe(ids[50]);
      expect(second.nextCursor).toBe(ids[99]);
      if (second.previousCursor === null || second.nextCursor === null) {
        throw new Error('Missing page cursor');
      }
      const previous = yield* reader.list({ cursor: second.previousCursor, direction: 'newer' });
      expect(previous).toEqual(first);

      const last = yield* reader.list({ cursor: second.nextCursor, direction: 'older' });
      expect(last.items.map(({ id }) => id)).toEqual(ids.slice(100));
      expect(last.nextCursor).toBeNull();
      expect(
        new Set([...first.items, ...second.items, ...last.items].map(({ id }) => id)).size,
      ).toBe(121);
      expect(Object.keys(first.items[0] ?? {}).sort()).toEqual([
        'action',
        'actorUserId',
        'id',
        'occurredAt',
        'resourceId',
        'resourceType',
      ]);
      expect(JSON.stringify(first)).not.toContain('Excluded audit detail');
    }).pipe(Effect.provide(readerLayer()), Effect.runPromise);
  });

  it('orders same-millisecond events by ULID and applies exact filters to both cursors', async () => {
    await Effect.gen(function* () {
      const ids = yield* seedEvents(7, true);
      const reader = yield* AuditReader;
      const all = yield* reader.list({});
      expect(all.items.map(({ id }) => id)).toEqual(ids);
      const quotes = all.items.filter(({ action }) => action === 'quote.created');
      const filters = { action: 'quote.created', resourceType: 'quote', limit: 2 } as const;
      const first = yield* reader.list(filters);
      expect(first.items).toEqual(quotes.slice(0, 2));
      expect(first.previousCursor).toBeNull();
      if (first.nextCursor === null) throw new Error('Missing filtered cursor');
      const second = yield* reader.list({ ...filters, cursor: first.nextCursor });
      expect(second.items).toEqual(quotes.slice(2));
      expect(second.nextCursor).toBeNull();
      if (second.previousCursor === null) throw new Error('Missing filtered previous cursor');
      expect(
        yield* reader.list({ ...filters, cursor: second.previousCursor, direction: 'newer' }),
      ).toEqual(first);
      expect(yield* reader.list({ action: 'quote.created', resourceType: 'invoice' })).toEqual({
        items: [],
        previousCursor: null,
        nextCursor: null,
      });
      expect((yield* reader.list({ resourceType: 'invoice' })).items).toEqual(
        all.items.filter(({ resourceType }) => resourceType === 'invoice'),
      );
    }).pipe(Effect.provide(readerLayer()), Effect.runPromise);
  });

  it('keeps forward traversal stable when a newer event arrives', async () => {
    await Effect.gen(function* () {
      const ids = yield* seedEvents(4);
      const reader = yield* AuditReader;
      const first = yield* reader.list({ limit: 2 });
      (yield* Audit).insert({
        action: 'quote.created',
        actorUserId: null,
        resourceType: 'quote',
        resourceId: 'later',
        occurredAt: 1_788_000_010_000,
      });
      if (first.nextCursor === null) throw new Error('Missing next cursor');
      const second = yield* reader.list({ limit: 2, cursor: first.nextCursor });
      expect(second.items.map(({ id }) => id)).toEqual(ids.slice(2));
      expect(second.nextCursor).toBeNull();
    }).pipe(Effect.provide(readerLayer()), Effect.runPromise);
  });

  it('handles an empty database and an arbitrary valid cursor without an offset', async () => {
    await Effect.gen(function* () {
      const reader = yield* AuditReader;
      expect(yield* reader.list({})).toEqual({ items: [], previousCursor: null, nextCursor: null });
      yield* seedEvents(2);
      const cursor = '00000000000000000000000000';
      expect(yield* reader.list({ cursor })).toEqual({
        items: [],
        previousCursor: cursor,
        nextCursor: null,
      });
      expect((yield* reader.list({ cursor, direction: 'newer' })).items).toHaveLength(2);
    }).pipe(Effect.provide(readerLayer()), Effect.runPromise);
  });

  it('rejects invalid typed limits and cursors before querying', async () => {
    await Effect.gen(function* () {
      const reader = yield* AuditReader;
      const prepare = vi.spyOn((yield* Database).sqlite, 'prepare');
      for (const query of [{ limit: 51 }, { limit: 0 }, { limit: 1.5 }, { cursor: 'invalid' }]) {
        const error = yield* reader.list(query).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: 'InvalidAuditQuery', code: 'audit.invalid_query' });
      }
      expect(prepare).not.toHaveBeenCalled();
      prepare.mockRestore();
    }).pipe(Effect.provide(readerLayer()), Effect.runPromise);
  });
});
