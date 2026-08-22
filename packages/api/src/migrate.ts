import { NodeRuntime } from '@effect/platform-node';
import { Config, DateTime, Effect, Option, Schema } from 'effect';

import { migrateDatabase } from './database/database.js';
import { RuntimeConfigurationLive } from './runtime-config.js';

Effect.gen(function* () {
  const filename = yield* Config.string('DATABASE_PATH').pipe(
    Config.withDefault('data/froment.sqlite'),
  );
  const migrationsFolder = yield* Config.string('MIGRATIONS_ROOT');
  const timeZoneName = yield* Config.schema(
    Schema.String.check(
      Schema.makeFilter((value) => Option.isSome(DateTime.zoneMakeNamed(value)), {
        message: 'config.time_zone.invalid',
      }),
    ),
    'BUSINESS_TIME_ZONE',
  );
  yield* migrateDatabase({
    filename,
    migrationsFolder,
    businessTimeZone: DateTime.zoneMakeNamedUnsafe(timeZoneName),
  });
}).pipe(Effect.provide(RuntimeConfigurationLive), NodeRuntime.runMain);
