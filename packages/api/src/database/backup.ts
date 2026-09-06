import Sqlite from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { Context, Effect, Layer, Schema } from 'effect';
import { openSync, closeSync, unlinkSync, fsyncSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { verifyArtifactContent } from '../documents/artifact-integrity.js';

export class BackupError extends Schema.TaggedError<BackupError>()('BackupError', {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

export interface BackupPaths {
  readonly databasePath: string;
  readonly backupPath: string;
  readonly migrationsRoot: string;
}
export interface VerifiedBackup {
  readonly migrations: number;
  readonly artifacts: number;
}
export class DatabaseBackup extends Context.Service<
  DatabaseBackup,
  {
    readonly create: (paths: BackupPaths) => Effect.Effect<VerifiedBackup, BackupError>;
    readonly verify: (
      backupPath: string,
      migrationsRoot: string,
    ) => Effect.Effect<VerifiedBackup, BackupError>;
    readonly restore: (paths: BackupPaths) => Effect.Effect<VerifiedBackup, BackupError>;
  }
>()('@froment/api/DatabaseBackup') {}

const Migration = Schema.Struct({ name: Schema.String, hash: Schema.String });
const Artifact = Schema.Struct({ content: Schema.Uint8Array, sha256: Schema.String });

const verifyFile = (path: string, migrationsRoot: string): VerifiedBackup => {
  const sqlite = new Sqlite(path, { readonly: true, fileMustExist: true });
  try {
    const integrity = sqlite.prepare('pragma integrity_check').pluck().all();
    if (integrity.length !== 1 || integrity[0] !== 'ok') throw new Error('backup.integrity_failed');
    if (sqlite.prepare('pragma foreign_key_check').all().length !== 0)
      throw new Error('backup.foreign_keys_failed');
    const expected = readMigrationFiles({ migrationsFolder: migrationsRoot });
    const actual = Schema.decodeUnknownSync(Schema.Array(Migration))(
      sqlite.prepare('select name, hash from __drizzle_migrations order by id').all(),
    );
    if (
      actual.length !== expected.length ||
      actual.some(
        (row, index) => row.name !== expected[index]?.name || row.hash !== expected[index]?.hash,
      )
    ) {
      throw new Error('backup.migrations_mismatch');
    }
    let artifacts = 0;
    for (const row of sqlite.prepare('select content, sha256 from document_artifacts').iterate()) {
      verifyArtifactContent(Schema.decodeUnknownSync(Artifact)(row));
      artifacts++;
    }
    return { migrations: actual.length, artifacts };
  } finally {
    sqlite.close();
  }
};

const syncFile = (path: string) => {
  const descriptor = openSync(path, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

const transfer = async (
  sourcePath: string,
  targetPath: string,
  migrationsRoot: string,
): Promise<VerifiedBackup> => {
  if (resolve(sourcePath) === resolve(targetPath)) throw new Error('backup.same_path');
  const source = new Sqlite(sourcePath, { readonly: true, fileMustExist: true });
  let created = false;
  try {
    const descriptor = openSync(targetPath, 'wx', 0o600);
    closeSync(descriptor);
    created = true;
    await source.backup(targetPath);
    const result = verifyFile(targetPath, migrationsRoot);
    syncFile(targetPath);
    syncFile(dirname(resolve(targetPath)));
    return result;
  } catch (cause) {
    if (created) unlinkSync(targetPath);
    throw cause;
  } finally {
    source.close();
  }
};

export const DatabaseBackupLive = Layer.succeed(
  DatabaseBackup,
  DatabaseBackup.of({
    verify: Effect.fn('DatabaseBackup.verify')((backupPath: string, migrationsRoot: string) =>
      Effect.try({
        try: () => verifyFile(backupPath, migrationsRoot),
        catch: (cause) => new BackupError({ operation: 'backup.verify', cause }),
      }),
    ),
    create: Effect.fn('DatabaseBackup.create')((paths: BackupPaths) =>
      Effect.tryPromise({
        try: () => transfer(paths.databasePath, paths.backupPath, paths.migrationsRoot),
        catch: (cause) => new BackupError({ operation: 'backup.create', cause }),
      }),
    ),
    restore: Effect.fn('DatabaseBackup.restore')((paths: BackupPaths) =>
      Effect.tryPromise({
        try: () => transfer(paths.backupPath, paths.databasePath, paths.migrationsRoot),
        catch: (cause) => new BackupError({ operation: 'backup.restore', cause }),
      }),
    ),
  }),
);
