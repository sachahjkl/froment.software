import { Effect } from 'effect';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Sqlite from 'better-sqlite3';
import { expect, it } from 'vitest';
import { DatabaseBackup, DatabaseBackupLive } from './backup.js';
import {
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('backs up a live WAL database, verifies PDFs, restores without overwriting, and rejects altered artifacts', async () => {
  const server = await startHttpTestServer();
  const migrationsRoot = join(import.meta.dirname, '../../drizzle');
  const directory = join(dirname(server.databaseFilename), 'backups');
  await mkdir(directory, { mode: 0o700 });
  const backupPath = join(directory, 'snapshot.sqlite');
  const restoredPath = join(directory, 'restored.sqlite');
  const paths = { databasePath: server.databaseFilename, backupPath, migrationsRoot };
  try {
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const rendered = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions/1/pdf`, {
      method: 'POST',
      headers: server.jsonHeaders,
    });
    expect(rendered.status).toBe(200);
    const result = await Effect.runPromise(
      DatabaseBackup.use((backup) => backup.create(paths)).pipe(Effect.provide(DatabaseBackupLive)),
    );
    expect(result.artifacts).toBeGreaterThan(0);
    expect(result.migrations).toBeGreaterThan(10);
    const command = await promisify(execFile)(
      process.execPath,
      [join(import.meta.dirname, '../../dist/backup.cjs')],
      {
        env: {
          ...process.env,
          BACKUP_ACTION: 'verify',
          BACKUP_PATH: backupPath,
          MIGRATIONS_ROOT: migrationsRoot,
        },
        timeout: 10000,
      },
    );
    expect(JSON.parse(command.stdout)).toEqual(result);
    expect((await stat(backupPath)).mode & 0o777).toBe(0o600);
    const originalBackup = await readFile(backupPath);
    await expect(
      Effect.runPromise(
        DatabaseBackup.use((backup) => backup.create(paths)).pipe(
          Effect.provide(DatabaseBackupLive),
        ),
      ),
    ).rejects.toThrow();
    expect(await readFile(backupPath)).toEqual(originalBackup);
    const restored = await Effect.runPromise(
      DatabaseBackup.use((backup) => backup.restore({ ...paths, databasePath: restoredPath })).pipe(
        Effect.provide(DatabaseBackupLive),
      ),
    );
    expect(restored).toEqual(result);
    expect((await stat(restoredPath)).mode & 0o777).toBe(0o600);
    await expect(
      Effect.runPromise(
        DatabaseBackup.use((backup) => backup.restore(paths)).pipe(
          Effect.provide(DatabaseBackupLive),
        ),
      ),
    ).rejects.toThrow();
    const database = new Sqlite(restoredPath);
    try {
      expect(database.prepare('select count(*) from password_credentials').pluck().get()).toBe(1);
      expect(database.prepare('select count(*) from quotes').pluck().get()).toBe(1);
      database.exec('drop trigger document_artifacts_immutable_update');
      database.prepare('update document_artifacts set sha256 = ?').run('0'.repeat(64));
    } finally {
      database.close();
    }
    await expect(
      Effect.runPromise(
        DatabaseBackup.use((backup) => backup.verify(restoredPath, migrationsRoot)).pipe(
          Effect.provide(DatabaseBackupLive),
        ),
      ),
    ).rejects.toThrow();
    const invalidTarget = join(directory, 'invalid.sqlite');
    await expect(
      Effect.runPromise(
        DatabaseBackup.use((backup) =>
          backup.restore({ ...paths, backupPath: restoredPath, databasePath: invalidTarget }),
        ).pipe(Effect.provide(DatabaseBackupLive)),
      ),
    ).rejects.toThrow();
    await expect(stat(invalidTarget)).rejects.toThrow();
    expect(
      (await fetch(`${server.baseUrl}/api/quotes/${quote.id}`, { headers: server.sessionHeaders }))
        .status,
    ).toBe(200);
  } finally {
    await server.close();
  }
}, 20000);
