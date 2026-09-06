import { IntegrationUnavailable, type IntegrationSubmissionValue } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { EmailProvider, SimulatedProviders } from './providers.js';
import { EmailMockActions } from './provider-mocks.js';
import { IntegrationsLive } from './service.js';
import { IntegrationRetries, IntegrationRetriesLive } from './retries.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const operationId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const request: IntegrationSubmissionValue = {
  kind: 'email',
  expectedMode: 'simulation',
  requestId: randomUUID(),
  reference: 'TEST',
  recipient: 'test@example.test',
  subject: 'Test',
  body: 'Not sent.',
};

it('persists bounded retry attempts, recovers leases, preserves request keys, and rechecks account permissions', async () => {
  const database = makeMigratedDatabaseLayer({
    filename: ':memory:',
    migrationsFolder: join(import.meta.dirname, '../../drizzle'),
  });
  const calls: IntegrationSubmissionValue[] = [];
  let unavailable = true;
  const provider = Layer.succeed(
    EmailProvider,
    EmailProvider.of({
      ...EmailMockActions,
      mode: 'simulation',
      submit: Effect.fn('RetryTest.submit')(function* (input) {
        calls.push(input);
        if (unavailable)
          return yield* new IntegrationUnavailable({ code: 'integration.unavailable' });
        return {
          mode: 'simulation' as const,
          status: 'simulated' as const,
          id: `simulation:${input.requestId}`,
        };
      }),
    }),
  );
  const retries = IntegrationRetriesLive.pipe(
    Layer.provide(IntegrationsLive.pipe(Layer.provide(Layer.merge(SimulatedProviders, provider)))),
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const { sqlite } = yield* Database;
      sqlite
        .prepare(
          "insert into roles (id, name, created_at) values ('01ARZ3NDEKTSV4RRFFQ69G5FAX', 'administrator', 0)",
        )
        .run();
      sqlite
        .prepare(
          "insert into role_permissions (role_id, permission_code) values ('01ARZ3NDEKTSV4RRFFQ69G5FAX', 'integration.manage')",
        )
        .run();
      sqlite
        .prepare(
          "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Test', 'administrator', 0, 0)",
        )
        .run(actorId);
      sqlite
        .prepare(
          "insert into user_roles (user_id, role_id) select ?, id from roles where name = 'administrator'",
        )
        .run(actorId);
      sqlite
        .prepare(
          "insert into integration_operations (id, request_id, request, receipt, created_at, created_by_user_id) values (?, ?, ?, null, '2020-01-01T00:00:00.000Z', ?)",
        )
        .run(operationId, request.requestId, JSON.stringify(request), actorId);
      const run = IntegrationRetries.use((service) => service.runPending).pipe(
        Effect.provide(retries),
      );
      const list = IntegrationRetries.use((service) => service.list).pipe(Effect.provide(retries));
      yield* run;
      expect(calls).toEqual([request]);
      expect(yield* list).toMatchObject([
        { attempts: 1, status: 'waiting', error: 'integration.unavailable' },
      ]);
      yield* run;
      expect(calls).toHaveLength(1);
      sqlite
        .prepare("update integration_retries set status = 'processing', next_attempt_at = 0")
        .run();
      yield* run;
      expect(calls).toHaveLength(2);
      for (let attempt = 3; attempt <= 5; attempt++) {
        sqlite.prepare('update integration_retries set next_attempt_at = 0').run();
        yield* run;
      }
      expect(yield* list).toMatchObject([
        { attempts: 5, status: 'exhausted', nextAttemptAt: null },
      ]);
      yield* run;
      expect(calls).toHaveLength(5);
      expect(calls.every((call) => call.requestId === request.requestId)).toBe(true);
      sqlite
        .prepare(
          "update integration_retries set status = 'waiting', attempts = 0, next_attempt_at = 0",
        )
        .run();
      sqlite.prepare('update users set disabled_at = 1 where id = ?').run(actorId);
      yield* run;
      expect(yield* list).toMatchObject([
        { status: 'blocked', error: 'integration.retry_permission' },
      ]);
      expect(calls).toHaveLength(5);
      sqlite.prepare('update users set disabled_at = null where id = ?').run(actorId);
      sqlite.prepare('delete from user_roles where user_id = ?').run(actorId);
      sqlite
        .prepare(
          "update integration_retries set status = 'waiting', attempts = 0, next_attempt_at = 0",
        )
        .run();
      yield* run;
      expect(yield* list).toMatchObject([
        { status: 'blocked', error: 'integration.retry_permission' },
      ]);
      expect(calls).toHaveLength(5);
      sqlite
        .prepare(
          "insert into user_roles (user_id, role_id) select ?, id from roles where name = 'administrator'",
        )
        .run(actorId);
      sqlite
        .prepare(
          "update integration_retries set status = 'waiting', attempts = 0, next_attempt_at = 0",
        )
        .run();
      const liveProvider = Layer.effect(
        EmailProvider,
        Effect.gen(function* () {
          const simulated = yield* EmailProvider;
          return EmailProvider.of({ ...simulated, mode: 'live' });
        }),
      ).pipe(Layer.provide(provider));
      yield* IntegrationRetries.use((service) => service.runPending).pipe(
        Effect.provide(
          IntegrationRetriesLive.pipe(
            Layer.provide(
              IntegrationsLive.pipe(Layer.provide(Layer.merge(SimulatedProviders, liveProvider))),
            ),
          ),
        ),
      );
      expect(yield* list).toMatchObject([
        { status: 'blocked', error: 'integration.request_conflict' },
      ]);
      expect(calls).toHaveLength(5);
      sqlite
        .prepare(
          "update integration_retries set status = 'waiting', attempts = 0, next_attempt_at = 0",
        )
        .run();
      unavailable = false;
      yield* run;
      expect(yield* list).toMatchObject([
        { status: 'completed', error: null, nextAttemptAt: null },
      ]);
      yield* run;
      expect(calls).toHaveLength(6);
      expect(sqlite.prepare('select count(*) from integration_operations').pluck().get()).toBe(1);
    }).pipe(Effect.provide(AuditLive.pipe(Layer.provideMerge(database)))),
  );
});
