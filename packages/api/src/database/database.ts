import Sqlite from 'better-sqlite3';
import { Config, Context, Effect, Layer, Schema } from 'effect';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class DatabaseError extends Schema.TaggedError<DatabaseError>()('DatabaseError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface DatabaseService {
  readonly orm: BetterSQLite3Database;
  readonly sqlite: Sqlite.Database;
}

export class Database extends Context.Service<Database, DatabaseService>()(
  '@froment/api/Database',
) {}

export const makeDatabaseLayer = (options: {
  readonly filename: string;
  readonly migrationsFolder: string;
}) =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const sqlite = yield* Effect.acquireRelease(
        Effect.try({
          try: () => {
            mkdirSync(dirname(options.filename), { recursive: true });
            return new Sqlite(options.filename);
          },
          catch: (cause) => new DatabaseError({ operation: 'open database', cause }),
        }),
        (connection) => Effect.sync(() => connection.close()),
      );
      return yield* Effect.try({
        try: () => {
          sqlite.pragma('journal_mode = WAL');
          sqlite.pragma('foreign_keys = ON');
          sqlite.pragma('busy_timeout = 5000');
          sqlite.pragma('synchronous = FULL');
          const orm = drizzle({ client: sqlite });
          sqlite.pragma('foreign_keys = OFF');
          try {
            migrate(orm, { migrationsFolder: options.migrationsFolder });
            const violations = sqlite.prepare('PRAGMA foreign_key_check').all();
            if (violations.length > 0) {
              throw new Error('Database migrations introduced foreign key violations');
            }
          } finally {
            sqlite.pragma('foreign_keys = ON');
          }
          return Database.of({ orm, sqlite });
        },
        catch: (cause) => new DatabaseError({ operation: 'configure and migrate database', cause }),
      });
    }),
  );

export const DatabaseLive = Layer.unwrap(
  Effect.gen(function* () {
    const filename = yield* Config.string('DATABASE_PATH').pipe(
      Config.withDefault('data/froment.sqlite'),
    );
    const migrationsFolder = yield* Config.string('MIGRATIONS_ROOT');
    return makeDatabaseLayer({ filename, migrationsFolder });
  }),
);
