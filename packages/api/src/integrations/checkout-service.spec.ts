import { CheckoutOperation, InvoiceDetail, type CheckoutRequest } from '@froment/contracts';
import { ConfigProvider, DateTime, Deferred, Effect, Fiber, Layer, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { Database, DatabaseLive } from '../database/database.js';
import { invoiceIssueDate } from '../invoices/invoices.js';
import {
  acceptQuote,
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';
import { Checkouts, CheckoutsLive } from './checkout-service.js';
import {
  CheckoutTransport,
  CheckoutTransportError,
  type CheckoutSession,
  type CheckoutSubmission,
} from './checkout-transport.js';

const filenames: string[] = [];
afterAll(async () => {
  await Promise.all(filenames.map((filename) => unlink(filename)));
});
const seed = async (paidCents = 0) => {
  const server = await startHttpTestServer();
  try {
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    const post = (path: string, body: typeof Schema.Json.Type) =>
      fetch(`${server.baseUrl}${path}`, {
        method: 'POST',
        headers: { ...server.jsonHeaders, origin: server.baseUrl },
        body: JSON.stringify(body),
      });
    const draft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    expect(
      (await post(`/api/invoices/${draft.id}/issue`, { expectedVersion: draft.version })).status,
    ).toBe(200);
    let invoice = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await fetch(`${server.baseUrl}/api/invoices/${draft.id}`, {
          headers: server.sessionHeaders,
        })
      ).json(),
    );
    if (paidCents > 0)
      invoice = Schema.decodeUnknownSync(InvoiceDetail)(
        await (
          await post(`/api/invoices/${draft.id}/payments`, {
            requestId: randomUUID(),
            expectedVersion: invoice.version,
            amountCents: paidCents,
            paidOn: invoiceIssueDate(Date.now(), DateTime.zoneMakeNamedUnsafe('Europe/Paris')),
            method: 'transfer',
            reference: 'Existing receipt',
          })
        ).json(),
      );
    const db = new Sqlite(server.databaseFilename);
    const actorId = Schema.decodeUnknownSync(Schema.String)(
      db.prepare("select id from users where kind = 'administrator'").pluck().get(),
    );
    const filename = join(tmpdir(), `checkout-test-${randomUUID()}.sqlite`);
    await writeFile(filename, db.serialize());
    filenames.push(filename);
    db.close();
    return {
      invoice,
      actorId,
      database: AuditLive.pipe(
        Layer.provideMerge(
          DatabaseLive.pipe(
            Layer.provide(
              ConfigProvider.layer(ConfigProvider.fromUnknown({ DATABASE_PATH: filename })),
            ),
          ),
        ),
      ),
    };
  } finally {
    await server.close();
  }
};
const input = (invoice: typeof InvoiceDetail.Type): CheckoutRequest => ({
  requestId: randomUUID(),
  invoiceId: invoice.id,
  expectedVersion: invoice.version,
});
const session = (request: CheckoutSubmission): CheckoutSession => ({
  id: 'cs_test_example',
  mode: 'test',
  currency: 'EUR',
  amountCents: request.amountCents,
  requestId: request.requestId,
  revisionId: request.revisionId,
  status: 'open',
  url: 'https://checkout.stripe.com/c/pay/cs_test_example',
  expiresAt: request.expiresAt,
});
const fake = (
  overrides: Partial<typeof CheckoutTransport.Service> = {},
): typeof CheckoutTransport.Service => ({
  accountKey: 'test-account',
  publicOrigin: 'https://froment.example.test',
  connection: { credentialsPresent: true, testKey: true, webhookConfigured: false },
  create: (request) => Effect.succeed(session(request)),
  retrieve: () =>
    Effect.fail(new CheckoutTransportError({ code: 'checkout.unavailable', retryable: true })),
  ...overrides,
});
const services = (transport: typeof CheckoutTransport.Service) =>
  CheckoutsLive.pipe(Layer.provide(Layer.succeed(CheckoutTransport, transport)));

it('freezes invoice balances, resumes idempotently, verifies payment, and never changes local receipts', async () => {
  const { invoice, actorId, database } = await seed(5000);
  const calls: CheckoutSubmission[] = [];
  const transport = fake({
    create: (request) =>
      Effect.sync(() => {
        calls.push(request);
        return session(request);
      }),
    retrieve: () =>
      Effect.sync(() => {
        const request = calls[0];
        if (request === undefined) throw new Error('Missing creation request');
        return {
          ...session(request),
          status: 'paid' as const,
          url: null,
        };
      }),
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.now());
      const tests = yield* Checkouts.pipe(Effect.provide(services(transport)));
      const request = input(invoice);
      const queued = yield* tests.enqueue(request, actorId);
      expect(queued).toMatchObject({
        status: 'queued',
        amountCents: invoice.currentRevision.totalCents - 5000,
        revisionId: invoice.currentRevision.id,
      });
      expect(calls).toEqual([]);
      expect(yield* tests.enqueue(request, actorId)).toEqual(queued);
      expect(
        yield* tests
          .enqueue({ ...request, expectedVersion: request.expectedVersion + 1 }, actorId)
          .pipe(Effect.flip),
      ).toMatchObject({ code: 'checkout.conflict' });
      expect(yield* tests.enqueue(input(invoice), actorId).pipe(Effect.flip)).toMatchObject({
        code: 'checkout.active',
      });
      yield* tests.runPending();
      expect(yield* tests.list()).toMatchObject([{ status: 'open', attempts: 1 }]);
      const restored = yield* Checkouts.pipe(Effect.provide(services(transport)));
      yield* restored.receiveEvent({
        id: 'evt_completed',
        type: 'checkout.session.completed',
        sessionId: 'cs_test_example',
      });
      yield* restored.receiveEvent({
        id: 'evt_completed',
        type: 'checkout.session.completed',
        sessionId: 'cs_test_example',
      });
      expect((yield* restored.list())[0]?.status).toBe('open');
      yield* restored.runPending();
      expect(yield* restored.list()).toMatchObject([
        { status: 'paid', nextAttemptAt: null, checkoutUrl: null },
      ]);
      yield* restored.receiveEvent({
        id: 'evt_lateExpired',
        type: 'checkout.session.expired',
        sessionId: 'cs_test_example',
      });
      yield* restored.runPending();
      expect(calls).toHaveLength(1);
      const { sqlite } = yield* Database;
      expect(sqlite.prepare('select count(*) from invoice_payments').pluck().get()).toBe(1);
      expect(
        sqlite.prepare('select status from invoices where id = ?').pluck().get(invoice.id),
      ).toBe('issued');
      expect(sqlite.prepare('select count(*) from checkout_events').pluck().get()).toBe(2);
      expect(() =>
        sqlite.prepare('update checkout_operations set amount_cents = 100').run(),
      ).toThrow('checkout_immutable');
      expect(() => sqlite.prepare('delete from checkout_operations').run()).toThrow(
        'checkout_immutable',
      );
      expect(() => sqlite.prepare('delete from checkout_events').run()).toThrow(
        'checkout_event_immutable',
      );
      expect(Schema.is(CheckoutOperation)((yield* restored.list())[0])).toBe(true);
    }).pipe(Effect.provide(database), Effect.provide(TestClock.layer())),
  );
});

it.each(['permission', 'credentials', 'invoice', 'deadline'] as const)(
  'blocks unsafe creation after %s changes',
  async (change) => {
    const { invoice, actorId, database } = await seed();
    let calls = 0;
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.now());
        const tests = yield* Checkouts.pipe(Effect.provide(services(fake())));
        yield* tests.enqueue(input(invoice), actorId);
        const { sqlite } = yield* Database;
        if (change === 'permission')
          sqlite.prepare('delete from user_roles where user_id = ?').run(actorId);
        if (change === 'invoice')
          sqlite
            .prepare("update invoices set status = 'void', voided_at = issued_at where id = ?")
            .run(invoice.id);
        if (change === 'deadline') yield* TestClock.adjust('22 hours');
        const restored = yield* Checkouts.pipe(
          Effect.provide(
            services(
              fake({
                accountKey: change === 'credentials' ? 'changed' : 'test-account',
                create: (request) =>
                  Effect.sync(() => {
                    calls++;
                    return session(request);
                  }),
              }),
            ),
          ),
        );
        yield* restored.runPending();
        expect(yield* restored.list()).toMatchObject([
          { status: 'blocked', attempts: 0, nextAttemptAt: null },
        ]);
        expect(calls).toBe(0);
      }).pipe(Effect.provide(database), Effect.provide(TestClock.layer())),
    );
  },
);

it('uses five attempts at most and keeps the exact payload after interruption', async () => {
  const { invoice, actorId, database } = await seed();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.now());
      const entered = yield* Deferred.make<void>();
      const calls: CheckoutSubmission[] = [];
      const blocking = fake({
        create: Effect.fn('CheckoutFake.block')(function* (request) {
          calls.push(request);
          yield* Deferred.succeed(entered, undefined);
          return yield* Effect.never;
        }),
      });
      const tests = yield* Checkouts.pipe(Effect.provide(services(blocking)));
      yield* tests.enqueue(input(invoice), actorId);
      const fiber = yield* tests.runPending().pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* tests.runPending();
      expect(calls).toHaveLength(1);
      yield* Fiber.interrupt(fiber);
      const retrying = yield* Checkouts.pipe(
        Effect.provide(
          services(
            fake({
              create: (request) => {
                calls.push(request);
                return Effect.fail(
                  new CheckoutTransportError({ code: 'checkout.rateLimited', retryable: true }),
                );
              },
            }),
          ),
        ),
      );
      for (let attempt = 2; attempt <= 5; attempt++) {
        yield* TestClock.adjust('1 hour');
        yield* retrying.runPending();
        expect((yield* retrying.list())[0]?.attempts).toBe(attempt);
      }
      expect(calls).toHaveLength(5);
      expect(calls.every((request) => JSON.stringify(request) === JSON.stringify(calls[0]))).toBe(
        true,
      );
      expect(yield* retrying.list()).toMatchObject([{ status: 'failed', nextAttemptAt: null }]);
    }).pipe(Effect.provide(database), Effect.provide(TestClock.layer())),
  );
});

it('ignores stale lookup results and rejects mismatched amounts without confirming payment', async () => {
  const { invoice, actorId, database } = await seed();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.now());
      let created: CheckoutSubmission | undefined;
      const transport = fake({
        create: (request) => {
          created = request;
          return Effect.succeed(session(request));
        },
      });
      const tests = yield* Checkouts.pipe(Effect.provide(services(transport)));
      yield* tests.enqueue(input(invoice), actorId);
      yield* tests.runPending();
      if (created === undefined) throw new Error('Missing creation request');
      const valid = session(created);
      const entered = yield* Deferred.make<void>();
      const response = yield* Deferred.make<CheckoutSession>();
      const slow = yield* Checkouts.pipe(
        Effect.provide(
          services(
            fake({
              retrieve: () =>
                Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(response))),
            }),
          ),
        ),
      );
      yield* TestClock.adjust('30 seconds');
      const fiber = yield* slow.runPending().pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* TestClock.adjust('2 minutes');
      const fresh = yield* Checkouts.pipe(
        Effect.provide(
          services(
            fake({
              retrieve: () =>
                Effect.succeed({
                  ...valid,
                  status: 'paid',
                  amountCents: valid.amountCents + 1,
                }),
            }),
          ),
        ),
      );
      yield* fresh.runPending();
      expect(yield* fresh.list()).toMatchObject([
        { status: 'open', error: 'checkout.statusUnavailable' },
      ]);
      yield* Deferred.succeed(response, {
        ...valid,
        status: 'paid' as const,
      });
      yield* Fiber.join(fiber);
      expect(yield* fresh.list()).toMatchObject([
        { status: 'open', error: 'checkout.statusUnavailable' },
      ]);
    }).pipe(Effect.provide(database), Effect.provide(TestClock.layer())),
  );
});

it('invalidates a lookup lease when the credential binding changes', async () => {
  const { invoice, actorId, database } = await seed();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.now());
      const entered = yield* Deferred.make<void>();
      const response = yield* Deferred.make<CheckoutSession>();
      let created: CheckoutSubmission | undefined;
      const tests = yield* Checkouts.pipe(
        Effect.provide(
          services(
            fake({
              create: (request) => {
                created = request;
                return Effect.succeed(session(request));
              },
              retrieve: () =>
                Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(response))),
            }),
          ),
        ),
      );
      yield* tests.enqueue(input(invoice), actorId);
      yield* tests.runPending();
      yield* TestClock.adjust('30 seconds');
      const fiber = yield* tests.runPending().pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* TestClock.adjust('2 minutes');
      const changed = yield* Checkouts.pipe(
        Effect.provide(services(fake({ accountKey: 'changed' }))),
      );
      yield* changed.runPending();
      if (created === undefined) throw new Error('Missing creation request');
      yield* Deferred.succeed(response, { ...session(created), status: 'paid' as const });
      yield* Fiber.join(fiber);
      expect(yield* tests.list()).toMatchObject([
        { status: 'open', error: 'checkout.credentialsChanged', nextAttemptAt: null },
      ]);
    }).pipe(Effect.provide(database), Effect.provide(TestClock.layer())),
  );
});
