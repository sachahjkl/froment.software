import { IntegrationUnavailable, type IntegrationSubmissionValue } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { EmailProvider, SimulatedProviders } from './providers.js';
import { Integrations, IntegrationsLive } from './service.js';

const actorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const request = (): IntegrationSubmissionValue => ({
  kind: 'email',
  expectedMode: 'simulation',
  requestId: randomUUID(),
  reference: 'TEST',
  recipient: 'test@example.test',
  subject: 'Test',
  body: 'Not sent.',
});

describe('integration persistence', () => {
  it('keeps failed requests and resumes them through a new service instance with the same provider key', async () => {
    const databaseLayer = makeMigratedDatabaseLayer({
      filename: ':memory:',
      migrationsFolder: join(import.meta.dirname, '../../drizzle'),
    });
    const dependencyLayer = AuditLive.pipe(Layer.provideMerge(databaseLayer));
    const attempted: string[] = [];
    const provider = Layer.succeed(
      EmailProvider,
      EmailProvider.of({
        ...EmailMockActions,
        mode: 'simulation',
        submit: Effect.fn('EmailProvider.test')(function* (request) {
          attempted.push(request.requestId);
          return yield* new IntegrationUnavailable({ code: 'integration.unavailable' });
        }),
      }),
    );
    const failedLayer = IntegrationsLive.pipe(
      Layer.provide(Layer.merge(SimulatedProviders, provider)),
    );
    const restoredLayer = IntegrationsLive.pipe(Layer.provide(SimulatedProviders));
    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        database.sqlite
          .prepare(
            "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Test', 'administrator', 0, 0)",
          )
          .run(actorId);
        const input = request();
        const failed = yield* Integrations.use((service) => service.submit(input, actorId)).pipe(
          Effect.provide(failedLayer),
          Effect.flip,
        );
        expect(failed._tag).toBe('IntegrationUnavailable');
        expect(attempted).toEqual([input.requestId]);
        expect(database.sqlite.prepare('select receipt from integration_operations').get()).toEqual(
          { receipt: null },
        );
        const restored = yield* Integrations.use((service) => service.submit(input, actorId)).pipe(
          Effect.provide(restoredLayer),
        );
        expect(restored.receipt).toMatchObject({
          mode: 'simulation',
          status: 'simulated',
          id: `simulation:email:${input.requestId}`,
        });
        const replay = yield* Integrations.use((service) => service.submit(input, actorId)).pipe(
          Effect.provide(failedLayer),
        );
        expect(replay).toEqual(restored);
        expect(attempted).toHaveLength(1);
        expect(
          database.sqlite.prepare('select count(*) as count from integration_operations').get(),
        ).toEqual({ count: 1 });
        expect(
          database.sqlite
            .prepare("select count(*) as count from audit_events where action like 'integration.%'")
            .get(),
        ).toEqual({ count: 2 });
      }).pipe(Effect.provide(dependencyLayer)),
    );
  });
});
import { EmailMockActions } from './provider-mocks.js';
