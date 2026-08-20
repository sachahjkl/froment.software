import { NodeRuntime } from '@effect/platform-node';
import { Config, Effect } from 'effect';

import { migrateDatabase } from './database/database.js';

Effect.gen(function* () {
  const filename = yield* Config.string('DATABASE_PATH').pipe(
    Config.withDefault('data/froment.sqlite'),
  );
  const migrationsFolder = yield* Config.string('MIGRATIONS_ROOT');
  yield* migrateDatabase({ filename, migrationsFolder });
}).pipe(NodeRuntime.runMain);
