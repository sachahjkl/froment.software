import { Effect, Layer } from 'effect';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeDatabaseLayer, migrateDatabase } from '../src/database/database.js';

export const makeMigratedDatabaseLayer = (options: {
  readonly filename: string;
  readonly migrationsFolder: string;
}) => {
  const filename =
    options.filename === ':memory:'
      ? join(tmpdir(), `froment-test-${randomUUID()}.sqlite`)
      : options.filename;
  return Layer.unwrap(
    migrateDatabase({ ...options, filename }).pipe(Effect.as(makeDatabaseLayer({ filename }))),
  );
};
