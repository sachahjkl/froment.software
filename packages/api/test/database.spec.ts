import Sqlite from 'better-sqlite3';
import { Effect, Schema } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { Database, makeDatabaseLayer } from '../src/database/database.js';
import { UserRow } from '../src/database/schema.js';

describe('Database', () => {
  const directories: Array<string> = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('migrates and configures a new SQLite database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-'));
    directories.push(directory);
    const filename = join(directory, 'database.sqlite');
    const migrationsFolder = join(import.meta.dirname, '..', 'drizzle');

    const state = await Effect.runPromise(
      Database.use(({ sqlite }) =>
        Effect.sync(() => ({
          foreignKeys: sqlite.pragma('foreign_keys', { simple: true }),
          journalMode: sqlite.pragma('journal_mode', { simple: true }),
          permissions: sqlite.prepare('select count(*) from permissions').pluck().get(),
          synchronous: sqlite.pragma('synchronous', { simple: true }),
          tables: sqlite
            .prepare("select name from sqlite_master where type = 'table' order by name")
            .pluck()
            .all(),
        })),
      ).pipe(Effect.provide(makeDatabaseLayer({ filename, migrationsFolder }))),
    );

    expect(state.foreignKeys).toBe(1);
    expect(state.journalMode).toBe('wal');
    expect(state.permissions).toBe(29);
    expect(state.synchronous).toBe(2);
    expect(state.tables).toEqual(
      expect.arrayContaining(['access_credentials', 'permissions', 'roles', 'sessions', 'users']),
    );

    const sqlite = new Sqlite(filename);
    const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    sqlite
      .prepare(
        'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
      )
      .run(userId, 'Administrator', 'administrator', 1, 1);
    expect(() =>
      sqlite
        .prepare(
          'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
        )
        .run('invalid', 'Invalid', 'administrator', 1, 1),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
        )
        .run('01ARZ3NDEKTSV4RRFFQ69G5FAI', 'Invalid', 'administrator', 1, 1),
    ).toThrow();
    expect(() =>
      sqlite
        .prepare(
          'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
        )
        .run(null, 'Invalid', 'administrator', 1, 1),
    ).toThrow();
    expect(() => sqlite.prepare('insert into permissions (code) values (?)').run(null)).toThrow();

    const user = Schema.decodeUnknownSync(UserRow)({
      id: userId,
      displayName: 'Administrator',
      kind: 'administrator',
      createdAt: new Date(1),
      updatedAt: new Date(1),
      disabledAt: null,
    });
    expect(user.id).toBe(userId);
    expect(() =>
      Schema.decodeUnknownSync(UserRow)({
        ...user,
        id: '01arz3ndektsv4rrffq69g5fav',
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(UserRow)({
        ...user,
        id: '81ARZ3NDEKTSV4RRFFQ69G5FAV',
      }),
    ).toThrow();
    sqlite.close();
  });

  it('can apply the migrations more than once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-'));
    directories.push(directory);
    const options = {
      filename: join(directory, 'database.sqlite'),
      migrationsFolder: join(import.meta.dirname, '..', 'drizzle'),
    };

    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );
  });
});
