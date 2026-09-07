import { InvoiceDetail, Reminder, ReminderList, EmailSubmission } from '@froment/contracts';
import { Effect, Layer, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import Sqlite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createClientSession,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';
import { Database } from '../database/database.js';
import { AuditLive } from '../audit/audit.js';
import { Reminders, RemindersLive } from './reminders.js';
import { EmailProvider, SimulatedProviders } from './providers.js';
import { IntegrationRetries, IntegrationRetriesLive } from './retries.js';
import { IntegrationsLive } from './service.js';

it('schedules, cancels, prepares current balances once, and skips paid invoices or revoked permissions', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const headers = { ...server.jsonHeaders, origin: server.baseUrl };
  const sendTime = Date.now() + 86400000;
  const sendAt = new Date(sendTime).toISOString();
  const post = (path: string, body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const database = Layer.succeed(Database, { sqlite, orm: drizzle({ client: sqlite }) });
  const dependencies = AuditLive.pipe(Layer.provideMerge(database));
  const run = (live = false) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(sendTime + 1);
        yield* (yield* Reminders).runPending;
      }).pipe(
        Effect.provide(
          RemindersLive.pipe(
            Layer.provide(
              live
                ? Layer.merge(
                    SimulatedProviders,
                    Layer.effect(
                      EmailProvider,
                      Effect.gen(function* () {
                        return EmailProvider.of({ ...(yield* EmailProvider), mode: 'live' });
                      }),
                    ).pipe(Layer.provide(SimulatedProviders)),
                  )
                : SimulatedProviders,
            ),
            Layer.provide(dependencies),
          ),
        ),
        Effect.provide(TestClock.layer()),
      ),
    );
  try {
    await setIssuer(server);
    const client = await createClient(server);
    const session = await createClientSession(server, client.id);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    const created = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: accepted.orderId,
          serviceDate: '2026-08-20',
          dueDate: '2026-09-19',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    expect(
      (await post(`/api/invoices/${created.id}/issue`, { expectedVersion: created.version }))
        .status,
    ).toBe(200);
    const getInvoice = async () =>
      Schema.decodeUnknownSync(InvoiceDetail)(
        await (await fetch(`${server.baseUrl}/api/invoices/${created.id}`, { headers })).json(),
      );
    let invoice = await getInvoice();
    const input = {
      invoiceId: invoice.id,
      expectedVersion: invoice.version,
      sendAt,
      language: 'en',
      expectedMode: 'simulation',
    };
    const create = (id: string, request = input) =>
      fetch(`${server.baseUrl}/api/reminders/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(request),
      });
    const list = async () =>
      Schema.decodeUnknownSync(ReminderList)(
        await (await fetch(`${server.baseUrl}/api/reminders`, { headers })).json(),
      );
    expect((await fetch(`${server.baseUrl}/api/reminders`)).status).toBe(401);
    expect((await fetch(`${server.baseUrl}/api/reminders`, { headers: session })).status).toBe(403);
    expect(
      (await create(randomUUID(), { ...input, sendAt: '2020-01-01T00:00:00.000Z' })).status,
    ).toBe(409);
    expect((await create(randomUUID(), { ...input, expectedMode: 'live' })).status).toBe(409);
    const cancelledId = randomUUID();
    expect((await create(cancelledId)).status).toBe(200);
    expect((await create(cancelledId)).status).toBe(200);
    expect((await create(randomUUID())).status).toBe(409);
    expect(
      (
        await post('/api/integrations/operations', {
          kind: 'email',
          requestId: cancelledId,
          expectedMode: 'simulation',
          reference: 'TEST',
          recipient: 'test@example.test',
          subject: 'Bypass',
          body: 'Not allowed',
        })
      ).status,
    ).toBe(409);
    for (let attempt = 0; attempt < 2; attempt++)
      expect((await post(`/api/reminders/${cancelledId}/cancel`, {})).status).toBe(200);
    const modeId = randomUUID();
    expect((await create(modeId)).status).toBe(200);
    await run(true);
    expect((await list()).find((item) => item.id === modeId)).toMatchObject({
      status: 'skipped',
      reason: 'mode-changed',
    });
    const revokedId = randomUUID();
    const saved = Schema.decodeUnknownSync(Reminder)(await (await create(revokedId)).json());
    sqlite
      .prepare('update users set disabled_at = updated_at where id = ?')
      .run(saved.createdByUserId);
    await run();
    sqlite.prepare('update users set disabled_at = null where id = ?').run(saved.createdByUserId);
    expect((await list()).find((item) => item.id === revokedId)).toMatchObject({
      status: 'skipped',
      reason: 'permission-revoked',
    });
    const queuedId = randomUUID();
    expect((await create(queuedId)).status).toBe(200);
    sqlite.prepare("update clients set email = 'current@example.test' where id = ?").run(client.id);
    expect(
      (
        await post(`/api/invoices/${invoice.id}/payments`, {
          requestId: randomUUID(),
          expectedVersion: invoice.version,
          amountCents: 100,
          paidOn: '2026-09-01',
          method: 'transfer',
          reference: 'PARTIAL',
        })
      ).status,
    ).toBe(200);
    await run();
    await run();
    const queued = (await list()).find((item) => item.id === queuedId);
    expect(queued).toMatchObject({ status: 'queued', reason: null });
    const email = Schema.decodeUnknownSync(Schema.fromJsonString(EmailSubmission))(
      sqlite
        .prepare('select request from integration_operations where request_id = ?')
        .pluck()
        .get(queuedId),
    );
    expect(email.recipient).toBe('current@example.test');
    sqlite.prepare("update clients set email = 'changed@example.test' where id = ?").run(client.id);
    expect((await post('/api/integrations/operations', email)).status).toBe(409);
    sqlite.prepare("update clients set email = 'current@example.test' where id = ?").run(client.id);
    const reminderRole = Schema.decodeUnknownSync(Schema.String)(
      sqlite
        .prepare(
          "select role_id from role_permissions where permission_code = 'email.reminder.manage' limit 1",
        )
        .pluck()
        .get(),
    );
    sqlite
      .prepare(
        "delete from role_permissions where role_id = ? and permission_code = 'email.reminder.manage'",
      )
      .run(reminderRole);
    expect((await post('/api/integrations/operations', email)).status).toBe(409);
    sqlite
      .prepare(
        "insert into role_permissions (role_id, permission_code) values (?, 'email.reminder.manage')",
      )
      .run(reminderRole);
    expect(email.body).toContain('September 19, 2026');
    expect(email.body).toContain(((invoice.currentRevision.totalCents - 100) / 100).toFixed(2));
    expect(
      sqlite
        .prepare('select count(*) from integration_operations where request_id = ?')
        .pluck()
        .get(queuedId),
    ).toBe(1);
    expect(
      sqlite
        .prepare('select attempts from integration_retries where operation_id = ?')
        .pluck()
        .get(queued?.operationId),
    ).toBe(0);
    expect((await post(`/api/reminders/${queuedId}/cancel`, {})).status).toBe(409);
    invoice = await getInvoice();
    const paidId = randomUUID();
    expect((await create(paidId, { ...input, expectedVersion: invoice.version })).status).toBe(200);
    expect(
      (
        await post(`/api/invoices/${invoice.id}/payments`, {
          requestId: randomUUID(),
          expectedVersion: invoice.version,
          amountCents: invoice.currentRevision.totalCents - 100,
          paidOn: '2026-09-01',
          method: 'transfer',
          reference: 'BALANCE',
        })
      ).status,
    ).toBe(200);
    await run();
    expect((await list()).find((item) => item.id === paidId)).toMatchObject({
      status: 'skipped',
      reason: 'invoice-ineligible',
    });
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(sendTime + 2);
        yield* (yield* IntegrationRetries).runPending;
      }).pipe(
        Effect.provide(
          IntegrationRetriesLive.pipe(
            Layer.provide(IntegrationsLive.pipe(Layer.provide(SimulatedProviders))),
            Layer.provide(dependencies),
          ),
        ),
        Effect.provide(TestClock.layer()),
      ),
    );
    expect(
      sqlite
        .prepare('select status, error from integration_retries where operation_id = ?')
        .get(queued?.operationId),
    ).toEqual({ status: 'blocked', error: 'integration.request_conflict' });
    expect(
      sqlite
        .prepare('select receipt from integration_operations where request_id = ?')
        .pluck()
        .get(queuedId),
    ).toBeNull();
    expect((await post('/api/integrations/operations', email)).status).toBe(409);
    expect(
      sqlite
        .prepare('select receipt from integration_operations where request_id = ?')
        .pluck()
        .get(queuedId),
    ).toBeNull();
  } finally {
    sqlite.close();
    await server.close();
  }
}, 25000);
