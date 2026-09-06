import { NodeRuntime } from '@effect/platform-node';
import { Config, Console, Effect, Schema } from 'effect';
import { DatabaseBackup, DatabaseBackupLive } from './database/backup.js';

Effect.gen(function* () {
  const action = yield* Config.schema(
    Schema.Literals(['create', 'verify', 'restore']),
    'BACKUP_ACTION',
  );
  const backupPath = yield* Config.string('BACKUP_PATH');
  const migrationsRoot = yield* Config.string('MIGRATIONS_ROOT');
  const backup = yield* DatabaseBackup;
  if (action === 'verify') {
    yield* Console.log(JSON.stringify(yield* backup.verify(backupPath, migrationsRoot)));
    return;
  }
  const databasePath = yield* Config.string('DATABASE_PATH');
  const paths = { databasePath, backupPath, migrationsRoot };
  if (action === 'create') {
    yield* Console.log(JSON.stringify(yield* backup.create(paths)));
    return;
  }
  yield* Console.log(JSON.stringify(yield* backup.restore(paths)));
}).pipe(Effect.provide(DatabaseBackupLive), NodeRuntime.runMain);
