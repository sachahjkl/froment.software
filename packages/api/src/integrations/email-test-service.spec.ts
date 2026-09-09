import { EmailTestAddress } from '@froment/contracts';
import { Deferred, Effect, Fiber, Layer, Schema } from 'effect';
import { TestClock } from 'effect/testing';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { EmailTests, EmailTestsLive } from './email-test-service.js';
import { EmailTransport, EmailTransportError, type OutgoingEmail } from './email-transport.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const providerId = '13d1635c-64c8-4078-b0f5-d936fb3791dd';
const request = () => ({
  requestId: randomUUID(),
  subject: 'Connection test',
  body: 'A real test message.',
});
const setup = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  sqlite
    .prepare(
      "insert into roles (id, name, created_at) values ('01ARZ3NDEKTSV4RRFFQ69G5FAX', 'administrator', 0)",
    )
    .run();
  sqlite
    .prepare(
      "insert into role_permissions (role_id, permission_code) values ('01ARZ3NDEKTSV4RRFFQ69G5FAX', 'integration.configure')",
    )
    .run();
  sqlite
    .prepare(
      "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 0, 0)",
    )
    .run(actorId);
  sqlite
    .prepare(
      "insert into user_roles (user_id, role_id) select ?, id from roles where name = 'administrator'",
    )
    .run(actorId);
  yield* TestClock.setTime(1788955200000);
  return sqlite;
});
const databaseLayer = () =>
  AuditLive.pipe(
    Layer.provideMerge(
      makeMigratedDatabaseLayer({
        filename: ':memory:',
        migrationsFolder: join(import.meta.dirname, '../../drizzle'),
      }),
    ),
  );
const service = (transport: typeof EmailTransport.Service) =>
  EmailTestsLive.pipe(Layer.provide(Layer.succeed(EmailTransport, transport)));
const succeeded = {
  accountKey: 'test-account',
  send: () => Effect.succeed(providerId),
  delivery: () => Effect.succeed('delivered' as const),
} satisfies typeof EmailTransport.Service;

it('persists before sending, reuses requests after reconstruction, retries once, and never treats acceptance as delivery', async () => {
  const calls: OutgoingEmail[] = [];
  const transport = {
    ...succeeded,
    send: Effect.fn('EmailTestFake.send')(function* (email: OutgoingEmail) {
      calls.push(email);
      if (calls.length === 1)
        return yield* new EmailTransportError({ code: 'emailTest.unavailable', retryable: true });
      return providerId;
    }),
  };
  await Effect.runPromise(
    Effect.gen(function* () {
      const sqlite = yield* setup;
      const input = request();
      const create = EmailTests.use((tests) => tests.enqueue(input, actorId)).pipe(
        Effect.provide(service(transport)),
      );
      const run = EmailTests.use((tests) => tests.runPending()).pipe(
        Effect.provide(service(transport)),
      );
      const list = EmailTests.use((tests) => tests.list()).pipe(Effect.provide(service(transport)));
      expect((yield* create).status).toBe('queued');
      expect(calls).toEqual([]);
      expect((yield* create).status).toBe('queued');
      yield* run;
      expect(yield* list).toMatchObject([{ status: 'retrying', attempts: 1 }]);
      yield* run;
      expect(calls).toHaveLength(1);
      yield* TestClock.adjust('2 minutes');
      yield* run;
      expect(calls).toEqual([
        { ...input, ...EmailTestAddress, subject: '[Test] Connection test' },
        { ...input, ...EmailTestAddress, subject: '[Test] Connection test' },
      ]);
      expect(yield* list).toMatchObject([{ status: 'accepted', providerId, attempts: 2 }]);
      yield* create;
      yield* TestClock.adjust('15 seconds');
      yield* run;
      expect(yield* list).toMatchObject([{ status: 'delivered', nextAttemptAt: null }]);
      expect(
        sqlite
          .prepare(
            "select count(*) from audit_events where resource_id = ? and json_extract(metadata, '$.status') = 'delivered'",
          )
          .pluck()
          .get(input.requestId),
      ).toBe(1);
      yield* run;
      expect(calls).toHaveLength(2);
      expect(sqlite.prepare('select count(*) from email_tests').pluck().get()).toBe(1);
      expect(() =>
        sqlite
          .prepare("update email_tests set request = '{}' where request_id = ?")
          .run(input.requestId),
      ).toThrow('email_test_immutable');
      expect(() => sqlite.prepare('delete from email_tests').run()).toThrow('email_test_immutable');
      const conflict = yield* EmailTests.use((tests) =>
        tests.enqueue({ ...input, body: 'Changed' }, actorId),
      ).pipe(Effect.provide(service(transport)), Effect.flip);
      expect(conflict).toMatchObject({ code: 'emailTest.conflict' });
    }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
  );
});

it.each(['newer-lookup', 'permission', 'credentials', 'deadline'] as const)(
  'rejects late delivery results after %s invalidates the lease',
  async (change) => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const sqlite = yield* setup;
        const entered = yield* Deferred.make<void>();
        const response = yield* Deferred.make<'delivered'>();
        const slow = yield* EmailTests.pipe(
          Effect.provide(
            service({
              ...succeeded,
              delivery: () =>
                Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(response))),
            }),
          ),
        );
        const input = request();
        yield* slow.enqueue(input, actorId);
        yield* slow.runPending();
        yield* TestClock.adjust('15 seconds');
        const fiber = yield* slow.runPending().pipe(Effect.forkChild);
        yield* Deferred.await(entered);
        yield* TestClock.adjust(change === 'deadline' ? '24 hours' : '2 minutes');
        if (change === 'permission')
          sqlite.prepare('delete from user_roles where user_id = ?').run(actorId);
        const fresh = yield* EmailTests.pipe(
          Effect.provide(
            service({
              ...succeeded,
              accountKey: change === 'credentials' ? 'different-account' : succeeded.accountKey,
              delivery: () => Effect.succeed('accepted' as const),
            }),
          ),
        );
        yield* fresh.runPending();
        const expected = yield* fresh.list();
        yield* Deferred.succeed(response, 'delivered' as const);
        yield* Fiber.join(fiber);
        expect(yield* slow.list()).toEqual(expected);
        expect(expected).toMatchObject([
          {
            status: 'accepted',
            error: change === 'newer-lookup' ? null : 'emailTest.statusUnavailable',
          },
        ]);
        const events = Schema.decodeUnknownSync(Schema.Array(Schema.String))(
          sqlite
            .prepare('select metadata from audit_events where resource_id = ?')
            .pluck()
            .all(input.requestId),
        );
        expect(events.some((metadata) => metadata.includes('delivered'))).toBe(false);
        if (change !== 'newer-lookup')
          expect(events.some((metadata) => metadata.includes('emailTest.statusUnavailable'))).toBe(
            true,
          );
      }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
    );
  },
);

it('records each delivery transition once and rolls it back if the audit fails', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const sqlite = yield* setup;
      const tests = yield* EmailTests.pipe(Effect.provide(service(succeeded)));
      yield* tests.enqueue(request(), actorId);
      yield* tests.runPending();
      yield* TestClock.adjust('15 seconds');
      sqlite.exec(
        "create trigger reject_delivery_audit before insert on audit_events when json_extract(new.metadata, '$.status') = 'delivered' begin select raise(abort, 'audit unavailable'); end;",
      );
      expect((yield* tests.runPending().pipe(Effect.flip))._tag).toBe('DatabaseError');
      expect(yield* tests.list()).toMatchObject([{ status: 'accepted' }]);
      sqlite.exec('drop trigger reject_delivery_audit');
      yield* TestClock.adjust('2 minutes');
      yield* tests.runPending();
      yield* tests.runPending();
      expect(yield* tests.list()).toMatchObject([{ status: 'delivered' }]);
      expect(
        sqlite
          .prepare(
            "select count(*) from audit_events where json_extract(metadata, '$.status') = 'delivered'",
          )
          .pluck()
          .get(),
      ).toBe(1);
    }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
  );
});

it.each(['permission', 'credential', 'expiration'] as const)(
  'blocks unsafe sending after %s changes',
  async (change) => {
    const calls: OutgoingEmail[] = [];
    await Effect.runPromise(
      Effect.gen(function* () {
        const sqlite = yield* setup;
        const initial = service(succeeded);
        yield* EmailTests.use((tests) => tests.enqueue(request(), actorId)).pipe(
          Effect.provide(initial),
        );
        if (change === 'permission')
          sqlite.prepare('delete from user_roles where user_id = ?').run(actorId);
        if (change === 'expiration') yield* TestClock.adjust('23 hours');
        const transport = {
          ...succeeded,
          accountKey: change === 'credential' ? 'another-account' : 'test-account',
          send: (input: OutgoingEmail) =>
            Effect.sync(() => {
              calls.push(input);
              return providerId;
            }),
        };
        const tests = yield* EmailTests.pipe(Effect.provide(service(transport)));
        yield* tests.runPending();
        expect(yield* tests.list()).toMatchObject([
          { status: 'blocked', attempts: 0, nextAttemptAt: null },
        ]);
        expect(calls).toHaveLength(0);
      }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
    );
  },
);

it('claims each job once across concurrent workers and recovers an interrupted send with the same key', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* setup;
      const entered = yield* Deferred.make<void>();
      const calls: string[] = [];
      const blocking = {
        ...succeeded,
        send: Effect.fn('EmailTestFake.blocking')(function* (input: OutgoingEmail) {
          calls.push(input.requestId);
          yield* Deferred.succeed(entered, undefined);
          return yield* Effect.never;
        }),
      };
      const tests = yield* EmailTests.pipe(Effect.provide(service(blocking)));
      const input = request();
      yield* tests.enqueue(input, actorId);
      const first = yield* tests.runPending().pipe(Effect.forkChild);
      yield* Deferred.await(entered);
      yield* tests.runPending();
      expect(calls).toEqual([input.requestId]);
      yield* Fiber.interrupt(first);
      yield* tests.runPending();
      expect(calls).toHaveLength(1);
      yield* TestClock.adjust('2 minutes');
      const recovered = yield* EmailTests.pipe(
        Effect.provide(
          service({
            ...succeeded,
            send: (email) =>
              Effect.sync(() => {
                calls.push(email.requestId);
                return providerId;
              }),
          }),
        ),
      );
      yield* recovered.runPending();
      expect(calls).toEqual([input.requestId, input.requestId]);
      expect(yield* recovered.list()).toMatchObject([{ status: 'accepted', attempts: 2 }]);
    }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
  );
});

it('bounds retries at five and keeps an accepted send when delivery lookup fails', async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* setup;
      const tests = yield* EmailTests.pipe(
        Effect.provide(
          service({
            ...succeeded,
            send: () =>
              Effect.fail(
                new EmailTransportError({ code: 'emailTest.rateLimited', retryable: true }),
              ),
          }),
        ),
      );
      yield* tests.enqueue(request(), actorId);
      for (let attempt = 1; attempt <= 5; attempt++) {
        yield* tests.runPending();
        expect((yield* tests.list())[0]?.attempts).toBe(attempt);
        yield* TestClock.adjust('1 hour');
      }
      yield* tests.runPending();
      expect(yield* tests.list()).toMatchObject([
        { status: 'failed', attempts: 5, nextAttemptAt: null },
      ]);
      const accepted = yield* EmailTests.pipe(
        Effect.provide(
          service({
            ...succeeded,
            delivery: () =>
              Effect.fail(
                new EmailTransportError({ code: 'emailTest.rejected', retryable: false }),
              ),
          }),
        ),
      );
      yield* accepted.enqueue(request(), actorId);
      yield* accepted.runPending();
      yield* TestClock.adjust('15 seconds');
      yield* accepted.runPending();
      expect((yield* accepted.list())[0]).toMatchObject({
        status: 'accepted',
        attempts: 1,
        providerId,
        error: 'emailTest.statusUnavailable',
      });
    }).pipe(Effect.provide(databaseLayer()), Effect.provide(TestClock.layer())),
  );
});
