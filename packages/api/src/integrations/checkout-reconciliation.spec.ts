import { canReconcileCheckout } from '@froment/contracts';
import { Deferred, Effect, Fiber, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { Database } from '../database/database.js';
import { Checkouts, CheckoutsLive } from './checkout-service.js';
import {
  CheckoutTransport,
  CheckoutTransportError,
  type CheckoutSession,
  type CheckoutSubmission,
} from './checkout-transport.js';
import {
  integrationDatabaseLayer,
  integrationTestTime,
  seedIntegrationInvoice,
} from './invoice.spec-helper.js';

const session = (request: CheckoutSubmission): CheckoutSession => ({
  id: 'cs_test_reconciliation',
  mode: 'test',
  currency: 'EUR',
  amountCents: request.amountCents,
  requestId: request.requestId,
  revisionId: request.revisionId,
  status: 'open',
  url: 'https://checkout.stripe.com/c/pay/cs_test_reconciliation',
  expiresAt: request.expiresAt,
});
const fake = () => {
  let created: CheckoutSession | undefined;
  let createCalls = 0;
  const readCalls: string[] = [];
  const transport: typeof CheckoutTransport.Service = {
    accountKey: 'test-account',
    publicOrigin: 'https://example.test',
    connection: { credentialsPresent: true, testKey: true, webhookConfigured: false },
    create: (request) =>
      Effect.sync(() => {
        createCalls++;
        created = session(request);
        return created;
      }),
    retrieve: (id) =>
      Effect.sync(() => {
        readCalls.push(id);
        if (created === undefined) throw new Error('Session not created');
        return { ...created, status: 'expired' as const, url: null };
      }),
  };
  return {
    transport,
    readCalls,
    createCalls: () => createCalls,
    session: () => {
      if (created === undefined) throw new Error('Session not created');
      return created;
    },
  };
};
const service = (transport: typeof CheckoutTransport.Service) =>
  CheckoutsLive.pipe(Layer.provide(Layer.succeed(CheckoutTransport, transport)));

it.each(['permission', 'credentials', 'missing-key', 'live-key', 'window'] as const)(
  'reconciles an existing session after %s stops tracking without creating another payment',
  async (reason) => {
    const provider = fake();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(integrationTestTime);
        const invoice = yield* seedIntegrationInvoice();
        const request = {
          requestId: randomUUID(),
          invoiceId: invoice.invoiceId,
          expectedVersion: 1,
        };
        const original = yield* Checkouts.pipe(Effect.provide(service(provider.transport)));
        yield* original.enqueue(request, invoice.actorId);
        yield* original.runPending();
        const { sqlite } = yield* Database;
        if (reason === 'permission')
          sqlite.prepare('delete from user_roles where user_id = ?').run(invoice.actorId);
        const changed = {
          ...provider.transport,
          accountKey: reason === 'credentials' ? 'rotated-test-key' : provider.transport.accountKey,
          connection: {
            credentialsPresent: reason !== 'missing-key',
            testKey: reason !== 'live-key',
            webhookConfigured: false,
          },
        };
        const paused = yield* Checkouts.pipe(Effect.provide(service(changed)));
        yield* TestClock.adjust(reason === 'window' ? '4 days' : '30 seconds');
        yield* paused.runPending();
        const before = (yield* paused.list())[0];
        expect(before).toMatchObject({ status: 'open', nextAttemptAt: null });
        if (!before) throw new Error('Operation not recorded');
        expect(canReconcileCheckout(before)).toBe(true);
        if (reason === 'window') expect(before.error).toBe('checkout.statusWindowExceeded');
        if (reason === 'permission') {
          expect(
            yield* paused.reconcile(request.requestId, invoice.actorId).pipe(Effect.flip),
          ).toMatchObject({ code: 'checkout.reconcileDenied' });
          sqlite
            .prepare('insert into user_roles (user_id, role_id) values (?, ?)')
            .run(invoice.actorId, invoice.roleId);
        }
        if (reason === 'missing-key' || reason === 'live-key') {
          yield* paused.reconcile(request.requestId, invoice.actorId);
          expect(provider.readCalls).toEqual([]);
        }
        const restored = yield* Checkouts.pipe(
          Effect.provide(service({ ...changed, connection: provider.transport.connection })),
        );
        const result = yield* restored.reconcile(request.requestId, invoice.actorId);
        expect(result).toMatchObject({
          status: 'expired',
          nextAttemptAt: null,
          checkoutUrl: null,
          attempts: 1,
        });
        expect(provider.readCalls).toEqual(['cs_test_reconciliation']);
        expect(provider.createCalls()).toBe(1);
        yield* restored.reconcile(request.requestId, invoice.actorId);
        expect(provider.readCalls).toHaveLength(1);
        expect(
          (yield* restored.enqueue({ ...request, requestId: randomUUID() }, invoice.actorId))
            .status,
        ).toBe('queued');
        expect(sqlite.prepare('select count(*) from invoice_payments').pluck().get()).toBe(0);
        expect(
          sqlite
            .prepare('select account_key from checkout_operations where request_id = ?')
            .pluck()
            .get(request.requestId),
        ).toBe('test-account');
        expect(
          sqlite.prepare('select status from invoices where id = ?').pluck().get(invoice.invoiceId),
        ).toBe('issued');
      }).pipe(Effect.provide(integrationDatabaseLayer()), Effect.provide(TestClock.layer())),
    );
  },
);

it('resumes automatic reads only when the original authority, key and tracking window remain valid', async () => {
  const provider = fake();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const request = { requestId: randomUUID(), invoiceId: invoice.invoiceId, expectedVersion: 1 };
      const original = yield* Checkouts.pipe(Effect.provide(service(provider.transport)));
      yield* original.enqueue(request, invoice.actorId);
      yield* original.runPending();
      const changed = yield* Checkouts.pipe(
        Effect.provide(
          service({
            ...provider.transport,
            accountKey: 'rotated-key',
            retrieve: () => Effect.succeed(provider.session()),
          }),
        ),
      );
      yield* TestClock.adjust('30 seconds');
      yield* changed.runPending();
      expect(yield* changed.reconcile(request.requestId, invoice.actorId)).toMatchObject({
        status: 'open',
        nextAttemptAt: null,
        error: 'checkout.credentialsChanged',
      });
      const restored = yield* Checkouts.pipe(
        Effect.provide(
          service({ ...provider.transport, retrieve: () => Effect.succeed(provider.session()) }),
        ),
      );
      expect(yield* restored.reconcile(request.requestId, invoice.actorId)).toMatchObject({
        status: 'open',
        nextAttemptAt: expect.any(String),
        error: null,
      });
    }).pipe(Effect.provide(integrationDatabaseLayer()), Effect.provide(TestClock.layer())),
  );
});

it.each(['unavailable', 'mismatch'] as const)(
  'keeps %s reconciliation uncertain and permits another explicit read',
  async (failure) => {
    const provider = fake();
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(integrationTestTime);
        const invoice = yield* seedIntegrationInvoice();
        const request = {
          requestId: randomUUID(),
          invoiceId: invoice.invoiceId,
          expectedVersion: 1,
        };
        const original = yield* Checkouts.pipe(Effect.provide(service(provider.transport)));
        yield* original.enqueue(request, invoice.actorId);
        yield* original.runPending();
        yield* TestClock.adjust('4 days');
        yield* original.runPending();
        const uncertain = yield* Checkouts.pipe(
          Effect.provide(
            service({
              ...provider.transport,
              retrieve: () =>
                failure === 'unavailable'
                  ? Effect.fail(
                      new CheckoutTransportError({ code: 'checkout.unavailable', retryable: true }),
                    )
                  : Effect.succeed({
                      ...provider.session(),
                      status: 'paid',
                      amountCents: provider.session().amountCents + 1,
                    }),
            }),
          ),
        );
        expect(yield* uncertain.reconcile(request.requestId, invoice.actorId)).toMatchObject({
          status: 'open',
          nextAttemptAt: null,
          error: 'checkout.statusUnavailable',
        });
        expect(yield* original.reconcile(request.requestId, invoice.actorId)).toMatchObject({
          status: 'expired',
        });
        expect(provider.createCalls()).toBe(1);
      }).pipe(Effect.provide(integrationDatabaseLayer()), Effect.provide(TestClock.layer())),
    );
  },
);

it('fences late reconciliation results and records the authorized caller rather than the disabled author', async () => {
  const provider = fake();
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(integrationTestTime);
      const invoice = yield* seedIntegrationInvoice();
      const operator = yield* seedIntegrationInvoice();
      const request = { requestId: randomUUID(), invoiceId: invoice.invoiceId, expectedVersion: 1 };
      const original = yield* Checkouts.pipe(Effect.provide(service(provider.transport)));
      yield* original.enqueue(request, invoice.actorId);
      yield* original.runPending();
      const { sqlite } = yield* Database;
      sqlite.prepare('update users set disabled_at = updated_at where id = ?').run(invoice.actorId);
      yield* TestClock.adjust('30 seconds');
      yield* original.runPending();
      const entered = yield* Deferred.make<void>();
      const response = yield* Deferred.make<CheckoutSession>();
      const slow = yield* Checkouts.pipe(
        Effect.provide(
          service({
            ...provider.transport,
            retrieve: () =>
              Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(response))),
          }),
        ),
      );
      const fiber = yield* slow
        .reconcile(request.requestId, operator.actorId)
        .pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* original.reconcile(request.requestId, operator.actorId);
      expect(provider.readCalls).toEqual([]);
      yield* TestClock.adjust('2 minutes');
      expect(yield* original.reconcile(request.requestId, operator.actorId)).toMatchObject({
        status: 'expired',
      });
      yield* Deferred.succeed(response, { ...provider.session(), status: 'paid', url: null });
      yield* Fiber.join(fiber);
      expect(yield* original.list()).toMatchObject([{ status: 'expired' }]);
      expect(
        sqlite
          .prepare(
            "select actor_user_id from audit_events where resource_id = ? and json_extract(metadata, '$.status') = 'expired'",
          )
          .pluck()
          .get(request.requestId),
      ).toBe(operator.actorId);
    }).pipe(Effect.provide(integrationDatabaseLayer()), Effect.provide(TestClock.layer())),
  );
});
