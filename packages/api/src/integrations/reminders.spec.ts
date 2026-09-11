import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { Database } from '../database/database.js';
import {
  integrationDatabaseLayer,
  integrationTestTime,
  seedIntegrationInvoice,
} from './invoice.spec-helper.js';
import { SimulatedProviders } from './providers.js';
import { Reminders, RemindersLive } from './reminders.js';

const layer = () =>
  RemindersLive.pipe(
    Layer.provide(SimulatedProviders),
    Layer.provideMerge(integrationDatabaseLayer()),
  );

it('lists scheduled reminders by next deadline, then recent history before applying the limit', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const first = yield* seedIntegrationInvoice();
      const second = yield* seedIntegrationInvoice();
      const reminders = yield* Reminders;
      const { sqlite } = yield* Database;
      for (let index = 0; index < 101; index++) {
        const request = {
          invoiceId: first.invoiceId,
          expectedVersion: 1,
          expectedMode: 'simulation',
          language: 'fr',
          sendAt: new Date(integrationTestTime - (102 - index) * 60000).toISOString(),
        };
        sqlite
          .prepare(`insert into email_reminders (id, invoice_id, request, send_at, status, created_by_user_id, created_at)
        values (?, ?, ?, ?, 'cancelled', ?, ?)`)
          .run(
            randomUUID(),
            first.invoiceId,
            JSON.stringify(request),
            request.sendAt,
            first.actorId,
            request.sendAt,
          );
      }
      const laterId = randomUUID();
      const earlierId = randomUUID();
      const request = {
        invoiceId: first.invoiceId,
        expectedVersion: 1,
        expectedMode: 'simulation' as const,
        language: 'fr' as const,
        sendAt: new Date(integrationTestTime + 120000).toISOString(),
      };
      yield* reminders.create(laterId, request, first.actorId);
      yield* reminders.create(
        earlierId,
        {
          ...request,
          invoiceId: second.invoiceId,
          sendAt: new Date(integrationTestTime + 60000).toISOString(),
        },
        second.actorId,
      );
      const scheduled = yield* reminders.list;
      expect(scheduled).toHaveLength(100);
      expect(scheduled.slice(0, 2).map((reminder) => reminder.id)).toEqual([earlierId, laterId]);
      yield* TestClock.adjust('2 minutes');
      yield* reminders.runPending;
      const history = yield* reminders.list;
      expect(history).toHaveLength(100);
      expect(history.slice(0, 2).map((reminder) => [reminder.id, reminder.status])).toEqual([
        [laterId, 'queued'],
        [earlierId, 'queued'],
      ]);
    }).pipe(Effect.provide(layer()), Effect.provide(TestClock.layer())),
  );
});
