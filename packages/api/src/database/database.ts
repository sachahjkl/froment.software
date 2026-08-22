import Sqlite from 'better-sqlite3';
import { Config, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class DatabaseError extends Schema.TaggedError<DatabaseError>()('DatabaseError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export const isSqliteError = (cause: unknown, code: string): cause is Sqlite.SqliteError =>
  cause instanceof Sqlite.SqliteError && cause.code === code;

export interface DatabaseService {
  readonly orm: BetterSQLite3Database;
  readonly sqlite: Sqlite.Database;
}

export class Database extends Context.Service<Database, DatabaseService>()(
  '@froment/api/Database',
) {}

const MigrationArtifactRecord = Schema.Struct({
  id: Schema.String,
  content: Schema.Uint8Array,
  sha256: Schema.String,
});

const migrate = (
  sqlite: Sqlite.Database,
  migrationsFolder: string,
  businessTimeZone: DateTime.TimeZone.Named,
) => {
  sqlite.function('business_year', { deterministic: true }, (milliseconds: number) =>
    DateTime.toParts(
      DateTime.makeUnsafe(milliseconds).pipe(DateTime.setZone(businessTimeZone)),
    ).year.toString(),
  );
  const migrations = readMigrationFiles({ migrationsFolder });
  const artifactTableExists = sqlite
    .prepare("select 1 from sqlite_master where type = 'table' and name = 'document_artifacts'")
    .pluck()
    .get();
  if (artifactTableExists !== undefined) {
    const artifacts = Schema.decodeUnknownSync(Schema.Array(MigrationArtifactRecord))(
      sqlite.prepare('select id, content, sha256 from document_artifacts').all(),
    );
    for (const artifact of artifacts) {
      if (createHash('sha256').update(artifact.content).digest('hex') !== artifact.sha256) {
        throw new Error(`Document artifact ${artifact.id} has an invalid SHA-256 digest`);
      }
    }
  }

  sqlite.pragma('foreign_keys = OFF');
  try {
    sqlite
      .transaction(() => {
        sqlite.exec(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
          id INTEGER PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric,
          name text,
          applied_at TEXT
        )`);
        const appliedMigrations = new Map(
          Schema.decodeUnknownSync(
            Schema.Array(Schema.Struct({ name: Schema.String, hash: Schema.String })),
          )(
            sqlite
              .prepare(
                'select name, hash from __drizzle_migrations where name is not null order by id',
              )
              .all(),
          ).map(({ name, hash }) => [name, hash]),
        );
        for (const migration of migrations) {
          const appliedHash = appliedMigrations.get(migration.name);
          if (appliedHash !== undefined && appliedHash !== migration.hash) {
            throw new Error(`Applied migration ${migration.name} has a different hash`);
          }
        }
        const pending = migrations.filter((migration) => !appliedMigrations.has(migration.name));
        for (const migration of pending) {
          for (const statement of migration.sql) sqlite.exec(statement);
        }
        const violations = sqlite.prepare('PRAGMA foreign_key_check').all();
        if (violations.length > 0) {
          throw new Error('Database migrations introduced foreign key violations');
        }
        const recordMigration = sqlite.prepare(
          `insert into __drizzle_migrations (hash, created_at, name, applied_at)
           values (?, ?, ?, ?)`,
        );
        for (const migration of pending) {
          recordMigration.run(
            migration.hash,
            migration.folderMillis,
            migration.name,
            new Date().toISOString(),
          );
        }
      })
      .immediate();
  } finally {
    sqlite.pragma('foreign_keys = ON');
  }
};

export const migrateDatabase = (options: {
  readonly filename: string;
  readonly migrationsFolder: string;
  readonly businessTimeZone: DateTime.TimeZone.Named;
}) =>
  Effect.try({
    try: () => {
      mkdirSync(dirname(options.filename), { recursive: true });
      const sqlite = new Sqlite(options.filename);
      try {
        sqlite.pragma('busy_timeout = 5000');
        migrate(sqlite, options.migrationsFolder, options.businessTimeZone);
      } finally {
        sqlite.close();
      }
    },
    catch: (cause) => new DatabaseError({ operation: 'migrate database', cause }),
  });

export const makeDatabaseLayer = (options: { readonly filename: string }) =>
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
          return Database.of({ orm, sqlite });
        },
        catch: (cause) => new DatabaseError({ operation: 'configure database', cause }),
      });
    }),
  );

export const DatabaseLive = Layer.unwrap(
  Effect.gen(function* () {
    const filename = yield* Config.string('DATABASE_PATH').pipe(
      Config.withDefault('data/froment.sqlite'),
    );
    return makeDatabaseLayer({ filename });
  }),
);
