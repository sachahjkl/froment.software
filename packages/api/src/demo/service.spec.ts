import { Effect, Layer, Option, Redacted, Schema } from 'effect';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuditLive } from '../audit/audit.js';
import { Passwords } from '../authentication/password.js';
import { Database } from '../database/database.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { defaultRuntimeConfig, RuntimeConfiguration } from '../runtime-config.js';
import { Demo, DemoLive } from './service.js';

const layer = () => {
  const database = makeMigratedDatabaseLayer({
    filename: ':memory:',
    migrationsFolder: join(import.meta.dirname, '../../drizzle'),
  });
  const dependencies = Layer.mergeAll(
    database,
    AuditLive.pipe(Layer.provide(database)),
    Layer.succeed(
      Passwords,
      Passwords.of({
        hash: () => Effect.succeed('$argon2id$demo'),
        verify: () => Effect.succeed(true),
      }),
    ),
    Layer.succeed(RuntimeConfiguration, {
      ...defaultRuntimeConfig,
      application: { ...defaultRuntimeConfig.application, appEnvironment: 'staging' },
      demo: { password: Option.some(Redacted.make('demo-secret')) },
    }),
  );
  return Layer.merge(database, DemoLive.pipe(Layer.provide(dependencies)));
};

describe('Demonstration reset', () => {
  it('replaces a migrated database with valid deterministic staging data', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const demo = yield* Demo;
        const database = yield* Database;
        const first = yield* demo.reset(
          { password: 'demo-secret', confirmed: true },
          '01ARZ3NDEKTSV4RRFFQ69G5FAA',
        );
        const second = yield* demo.reset(
          { password: 'demo-secret', confirmed: true },
          '01ARZ3NDEKTSV4RRFFQ69G5FAA',
        );
        expect(second).toEqual(first);
        expect(database.sqlite.pragma('foreign_key_check')).toEqual([]);
        expect(
          Schema.decodeUnknownSync(Schema.Int)(
            database.sqlite.prepare('select count(*) from users').pluck().get(),
          ),
        ).toBeGreaterThan(5);
        expect(
          database.sqlite
            .prepare('select adapter from accounting_tax_filing_settings where id = 1')
            .pluck()
            .get(),
        ).toBe('local');
      }).pipe(Effect.provide(layer())),
    );
  });
});
