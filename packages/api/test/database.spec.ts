import Sqlite from 'better-sqlite3';
import { Effect, Schema } from 'effect';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
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
          clientRolePermissions: sqlite
            .prepare(
              `select permission_code from role_permissions
               join roles on roles.id = role_permissions.role_id
               where roles.name = 'client' order by permission_code`,
            )
            .pluck()
            .all(),
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
    expect(state.permissions).toBe(30);
    expect(state.clientRolePermissions).toEqual([
      'document.download',
      'invoice.read',
      'order.read',
      'quote.read',
    ]);
    expect(state.synchronous).toBe(2);
    expect(state.tables).toEqual(
      expect.arrayContaining([
        'access_credentials',
        'audit_events',
        'clients',
        'invoice_lines',
        'invoice_number_counter',
        'invoice_revisions',
        'invoices',
        'orders',
        'permissions',
        'quote_lines',
        'quote_links',
        'quote_revisions',
        'quote_signatures',
        'quotes',
        'roles',
        'sessions',
        'users',
      ]),
    );

    const schemaSqlite = new Sqlite(filename, { readonly: true });
    const quoteForeignKeys = schemaSqlite
      .prepare('select "table", on_delete as onDelete from pragma_foreign_key_list(\'quotes\')')
      .all();
    expect(quoteForeignKeys).toContainEqual({ table: 'clients', onDelete: 'NO ACTION' });
    const orderForeignKeys = schemaSqlite
      .prepare('select "table", on_delete as onDelete from pragma_foreign_key_list(\'orders\')')
      .all();
    expect(orderForeignKeys).toEqual(
      expect.arrayContaining([
        { table: 'clients', onDelete: 'NO ACTION' },
        { table: 'quote_revisions', onDelete: 'NO ACTION' },
        { table: 'quote_signatures', onDelete: 'NO ACTION' },
        { table: 'quotes', onDelete: 'NO ACTION' },
      ]),
    );
    expect(
      schemaSqlite
        .prepare('select next_value from invoice_number_counter where id = 1')
        .pluck()
        .get(),
    ).toBe(1);
    schemaSqlite.close();

    const sqlite = new Sqlite(filename);
    const auditEventId = '01ARZ3NDEKTSV4RRFFQ69G5FAT';
    sqlite
      .prepare(
        `insert into audit_events
         (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
         values (?, 'system.started', null, 'system', 'application', 1, '{}')`,
      )
      .run(auditEventId);
    expect(() =>
      sqlite.prepare('update audit_events set metadata = ? where id = ?').run('{}', auditEventId),
    ).toThrow('audit events are append-only');
    expect(() => sqlite.prepare('delete from audit_events where id = ?').run(auditEventId)).toThrow(
      'audit events are append-only',
    );
    expect(() =>
      sqlite
        .prepare(
          `insert into audit_events
           (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
           values (?, 'invalid action', null, 'system', 'application', 1, '{}')`,
        )
        .run('01ARZ3NDEKTSV4RRFFQ69G5FAS'),
    ).toThrow();
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
    expect(() =>
      sqlite
        .prepare('insert into clients (id, created_at, updated_at) values (?, ?, ?)')
        .run(userId, 1, 1),
    ).toThrow('client user required');
    const deletedClientId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    sqlite
      .prepare(
        "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Client', 'client', 1, 1)",
      )
      .run(deletedClientId);
    sqlite
      .prepare('insert into clients (id, created_at, updated_at) values (?, 1, 1)')
      .run(deletedClientId);
    sqlite
      .prepare(
        'insert into access_credentials (id, user_id, secret_hmac, created_at) values (?, ?, ?, 1)',
      )
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAX', deletedClientId, Buffer.alloc(32, 4));
    sqlite.prepare('delete from clients where id = ?').run(deletedClientId);
    expect(
      sqlite
        .prepare('select disabled_at is not null from users where id = ?')
        .pluck()
        .get(deletedClientId),
    ).toBe(1);
    expect(
      sqlite
        .prepare('select revoked_at is not null from access_credentials where user_id = ?')
        .pluck()
        .get(deletedClientId),
    ).toBe(1);

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

  it('assigns the fixed client role to existing clients during an upgrade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-client-role-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const clientRoleMigrations = [
      '20260820090553_client_role',
      '20260820102552_client_role_integrity',
    ];
    const migrations = (await readdir(sourceFolder)).filter(
      (migration) => !clientRoleMigrations.includes(migration),
    );
    await Promise.all(
      migrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const sqlite = new Sqlite(filename);
    sqlite
      .prepare(
        `insert into users (id, display_name, kind, created_at, updated_at)
         values (?, 'Existing client', 'client', 1, 1)`,
      )
      .run(clientId);
    sqlite
      .prepare('insert into clients (id, created_at, updated_at) values (?, 1, 1)')
      .run(clientId);
    sqlite.close();

    await Promise.all(
      clientRoleMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const role = await Effect.runPromise(
      Database.use(({ sqlite: connection }) =>
        Effect.sync(() => ({
          name: connection
            .prepare(
              `select roles.name from user_roles
               join roles on roles.id = user_roles.role_id
               where user_roles.user_id = ?`,
            )
            .pluck()
            .get(clientId),
          permissions: connection
            .prepare(
              `select permission_code from user_roles
               join role_permissions on role_permissions.role_id = user_roles.role_id
               where user_roles.user_id = ? order by permission_code`,
            )
            .pluck()
            .all(clientId),
        })),
      ).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    expect(role).toEqual({
      name: 'client',
      permissions: ['document.download', 'invoice.read', 'order.read', 'quote.read'],
    });
  });

  it('rejects a client role identifier collision during an upgrade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-client-role-collision-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const clientRoleMigrations = [
      '20260820090553_client_role',
      '20260820102552_client_role_integrity',
    ];
    const migrations = (await readdir(sourceFolder)).filter(
      (migration) => !clientRoleMigrations.includes(migration),
    );
    await Promise.all(
      migrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    sqlite
      .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
      .run('00000000000000000000000001', 'identifier-collision', 1);
    sqlite.close();
    await Promise.all(
      clientRoleMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );

    await expect(
      Effect.runPromise(
        Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
      ),
    ).rejects.toThrow();
  });

  it('backfills client users and administrator permissions during an upgrade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-upgrade-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const initialMigrations = ['20260819152049_familiar_rictor', '20260819152052_seed_permissions'];
    await Promise.all(
      initialMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const administratorId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const roleId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    sqlite
      .prepare(
        'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
      )
      .run(clientId, 'Existing client', 'client', 1, 2);
    sqlite
      .prepare(
        'insert into users (id, display_name, kind, created_at, updated_at) values (?, ?, ?, ?, ?)',
      )
      .run(administratorId, 'Administrator', 'administrator', 1, 1);
    sqlite
      .prepare('insert into roles (id, name, created_at) values (?, ?, ?)')
      .run(roleId, 'administrator', 1);
    sqlite.close();

    const clientMigration = '20260819163618_striped_krista_starr';
    await cp(join(sourceFolder, clientMigration), join(migrationsFolder, clientMigration), {
      recursive: true,
    });
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );
    const migratedSqlite = new Sqlite(filename);
    migratedSqlite.prepare('update clients set archived_at = ? where id = ?').run(3, clientId);
    migratedSqlite
      .prepare(
        'insert into access_credentials (id, user_id, secret_hmac, created_at) values (?, ?, ?, ?)',
      )
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAY', clientId, Buffer.alloc(32, 1), 1);
    migratedSqlite
      .prepare(
        'insert into sessions (id, user_id, token_hmac, csrf_hmac, created_at, last_seen_at, idle_expires_at, absolute_expires_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
        clientId,
        Buffer.alloc(32, 2),
        Buffer.alloc(32, 3),
        1,
        1,
        10,
        20,
      );
    migratedSqlite.close();
    const clientStateMigration = '20260819195929_nervous_maximus';
    await cp(
      join(sourceFolder, clientStateMigration),
      join(migrationsFolder, clientStateMigration),
      { recursive: true },
    );
    const state = await Effect.runPromise(
      Database.use(({ sqlite: connection }) =>
        Effect.sync(() => ({
          client: connection
            .prepare('select id, created_at as createdAt, updated_at as updatedAt from clients')
            .get(),
          permission: connection
            .prepare(
              "select permission_code from role_permissions where role_id = ? and permission_code = 'client.access.create'",
            )
            .pluck()
            .get(roleId),
          archivedAt: connection
            .prepare('select disabled_at from users where id = ?')
            .pluck()
            .get(clientId),
          clientColumns: connection
            .prepare('pragma table_info(clients)')
            .all()
            .map(
              (column) =>
                Schema.decodeUnknownSync(Schema.Struct({ name: Schema.String }))(column).name,
            ),
          credentialRevokedAt: connection
            .prepare('select revoked_at from access_credentials where user_id = ?')
            .pluck()
            .get(clientId),
          sessionRevokedAt: connection
            .prepare('select revoked_at from sessions where user_id = ?')
            .pluck()
            .get(clientId),
          foreignKeyViolations: connection.pragma('foreign_key_check'),
        })),
      ).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    expect(state.client).toEqual({ id: clientId, createdAt: 1, updatedAt: 2 });
    expect(state.permission).toBe('client.access.create');
    expect(state.archivedAt).toBe(3);
    expect(state.clientColumns).not.toContain('archived_at');
    expect(state.credentialRevokedAt).toBe(3);
    expect(state.sessionRevokedAt).toBe(3);
    expect(state.foreignKeyViolations).toEqual([]);
  });

  it('rebuilds referenced tables during an upgrade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-upgrade-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const previousMigrations = [
      '20260819152049_familiar_rictor',
      '20260819152052_seed_permissions',
      '20260819163618_striped_krista_starr',
      '20260819195929_nervous_maximus',
      '20260819201456_gray_quasar',
    ];
    await Promise.all(
      previousMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    const administratorId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const clientId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
    const revisionId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
    sqlite
      .prepare(
        "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 1, 1), (?, 'Client', 'client', 1, 1)",
      )
      .run(administratorId, clientId);
    sqlite
      .prepare('insert into clients (id, created_at, updated_at) values (?, 1, 1)')
      .run(clientId);
    sqlite
      .prepare(
        "insert into quotes (id, client_id, status, version, created_at, updated_at) values (?, ?, 'draft', 1, 1, 1)",
      )
      .run(quoteId, clientId);
    sqlite
      .prepare(
        "insert into quote_revisions (id, quote_id, version, client_display_name, title, conditions, currency, net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id) values (?, ?, 1, 'Client', 'Quote', '', 'EUR', 0, 0, 0, 1, ?)",
      )
      .run(revisionId, quoteId, administratorId);
    sqlite.close();

    const migration = '20260819205351_curved_thena';
    await cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true });
    const state = await Effect.runPromise(
      Database.use(({ sqlite: connection }) =>
        Effect.sync(() => ({
          clientId: connection
            .prepare('select client_id from quotes where id = ?')
            .pluck()
            .get(quoteId),
          foreignKeyViolations: connection.pragma('foreign_key_check'),
          revisionId: connection
            .prepare('select id from quote_revisions where quote_id = ?')
            .pluck()
            .get(quoteId),
        })),
      ).pipe(Effect.provide(makeDatabaseLayer(options))),
    );

    expect(state.clientId).toBe(clientId);
    expect(state.revisionId).toBe(revisionId);
    expect(state.foreignKeyViolations).toEqual([]);
  });
});
