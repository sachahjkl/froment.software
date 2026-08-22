import Sqlite from 'better-sqlite3';
import { Effect, Schema } from 'effect';
import { appendFile, cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { Database, makeDatabaseLayer } from '../src/database/database.js';
import { UserRow } from '../src/database/schema.js';
import { makeMigratedDatabaseLayer } from './database-layer.js';

describe('Database', () => {
  const directories: Array<string> = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('opens the application database without running migrations', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-'));
    directories.push(directory);
    const filename = join(directory, 'database.sqlite');

    const tables = await Effect.runPromise(
      Database.use(({ sqlite }) =>
        Effect.sync(() =>
          sqlite
            .prepare(
              "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
            )
            .pluck()
            .all(),
        ),
      ).pipe(Effect.provide(makeDatabaseLayer({ filename }))),
    );

    expect(tables).toEqual([]);
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
      ).pipe(Effect.provide(makeMigratedDatabaseLayer({ filename, migrationsFolder }))),
    );

    expect(state.foreignKeys).toBe(1);
    expect(state.journalMode).toBe('wal');
    expect(state.permissions).toBe(31);
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
        'business_reference_counters',
        'invoice_revisions',
        'invoices',
        'integration_token_permissions',
        'integration_tokens',
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
      schemaSqlite.prepare('select count(*) from business_reference_counters').pluck().get(),
    ).toBe(0);
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

  it('enforces integration token persistence invariants', async () => {
    const migrationsFolder = join(import.meta.dirname, '..', 'drizzle');

    await Effect.runPromise(
      Database.use(({ sqlite }) =>
        Effect.sync(() => {
          const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAA';
          const tokenId = '01ARZ3NDEKTSV4RRFFQ69G5FAB';
          sqlite
            .prepare(
              "insert into users (id, display_name, kind, created_at, updated_at) values (?, 'Administrator', 'administrator', 1, 1)",
            )
            .run(userId);
          expect(() =>
            sqlite
              .prepare(
                `insert into integration_tokens
                 (id, user_id, name, token_hmac, created_at, expires_at, rate_limit_per_minute)
                 values (?, ?, 'Invalid HMAC', ?, 1, 2, 120)`,
              )
              .run('01ARZ3NDEKTSV4RRFFQ69G5FAC', userId, Buffer.alloc(31)),
          ).toThrow();
          expect(() =>
            sqlite
              .prepare(
                `insert into integration_tokens
                 (id, user_id, name, token_hmac, created_at, expires_at, rate_limit_per_minute)
                 values (?, ?, 'Invalid expiry', ?, 2, 1, 120)`,
              )
              .run('01ARZ3NDEKTSV4RRFFQ69G5FAD', userId, Buffer.alloc(32, 1)),
          ).toThrow();
          sqlite
            .prepare(
              `insert into integration_tokens
               (id, user_id, name, token_hmac, created_at, expires_at, rate_limit_per_minute)
               values (?, ?, 'ERP', ?, 1, 1000, 120)`,
            )
            .run(tokenId, userId, Buffer.alloc(32, 2));
          sqlite
            .prepare(
              "insert into integration_token_permissions (token_id, permission_code) values (?, 'client.read')",
            )
            .run(tokenId);
          expect(() =>
            sqlite
              .prepare("update integration_tokens set name = 'Changed' where id = ?")
              .run(tokenId),
          ).toThrow('integration token identity is immutable');
          expect(() =>
            sqlite
              .prepare('delete from integration_token_permissions where token_id = ?')
              .run(tokenId),
          ).toThrow('integration token permissions are immutable');
          expect(() =>
            sqlite.prepare('delete from integration_tokens where id = ?').run(tokenId),
          ).toThrow('integration tokens are append-only');
          expect(() =>
            sqlite
              .prepare(
                'update integration_tokens set revoked_at = 10, revoked_by_user_id = ? where id = ?',
              )
              .run(userId, tokenId),
          ).not.toThrow();
          expect(() =>
            sqlite
              .prepare('update integration_tokens set revoked_at = null where id = ?')
              .run(tokenId),
          ).toThrow('integration token identity is immutable');
        }),
      ).pipe(Effect.provide(makeMigratedDatabaseLayer({ filename: ':memory:', migrationsFolder }))),
    );
  });

  it('can apply the migrations more than once', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-'));
    directories.push(directory);
    const options = {
      filename: join(directory, 'database.sqlite'),
      migrationsFolder: join(import.meta.dirname, '..', 'drizzle'),
    };

    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );
  });

  it('rejects a changed migration that was already applied', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-hash-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    await cp(sourceFolder, migrationsFolder, { recursive: true });
    const options = { filename: join(directory, 'database.sqlite'), migrationsFolder };

    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );
    const migration = (await readdir(migrationsFolder)).sort().at(-1);
    if (migration === undefined) throw new Error('No migration was copied.');
    await appendFile(join(migrationsFolder, migration, 'migration.sql'), '\n-- changed\n');

    await expect(
      Effect.runPromise(
        Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
      ),
    ).rejects.toMatchObject({
      _tag: 'DatabaseError',
      cause: expect.objectContaining({ message: expect.stringContaining('different hash') }),
    });
  });

  it('normalizes persisted document snapshots during an upgrade', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-documents-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const snapshotMigration = '20260821193319_certain_nighthawk';
    const migrations = (await readdir(sourceFolder)).filter(
      (migration) => migration !== snapshotMigration,
    );
    await Promise.all(
      migrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    sqlite.exec(`
      insert into users (id, display_name, kind, created_at, updated_at) values
        ('01ARZ3NDEKTSV4RRFFQ69G5FAA', 'Administrator', 'administrator', 1, 1),
        ('01ARZ3NDEKTSV4RRFFQ69G5FAB', 'Client', 'client', 1, 1);
      insert into clients (id, created_at, updated_at)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAB', 1, 1);
      insert into quotes
        (id, reference, client_id, status, version, created_at, updated_at)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAC', 'DE-2026-000001',
                '01ARZ3NDEKTSV4RRFFQ69G5FAB', 'accepted', 1, 1, 1);
      insert into quote_revisions
        (id, quote_id, version, client_display_name, title, conditions, currency,
         net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id,
         template_id, template_version, render_snapshot)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAD', '01ARZ3NDEKTSV4RRFFQ69G5FAC', 1,
                'Client', 'Quote', '', 'EUR', 10000, 2000, 12000, 1,
                '01ARZ3NDEKTSV4RRFFQ69G5FAA', 'quote-default', 2,
                '{"templateVersion":2}');
      insert into quote_links
        (id, revision_id, token_hmac, usage_policy, created_at, expires_at, consumed_at)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAE', '01ARZ3NDEKTSV4RRFFQ69G5FAD',
                zeroblob(32), 'single-use', 1, 2, 1);
      insert into audit_events
        (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAF', 'quote.accepted', null, 'quote',
                '01ARZ3NDEKTSV4RRFFQ69G5FAC', 1, '{}');
      insert into quote_signatures
        (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind,
         signature_value, signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256,
         audit_event_id, evidence_content, evidence_sha256)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAG', '01ARZ3NDEKTSV4RRFFQ69G5FAC',
                '01ARZ3NDEKTSV4RRFFQ69G5FAD', '01ARZ3NDEKTSV4RRFFQ69G5FAE', 'Client', 1,
                'typed', 'Client', 1, '127.0.0.1', '', '${'a'.repeat(64)}',
                '${'b'.repeat(64)}', '01ARZ3NDEKTSV4RRFFQ69G5FAF', x'01', '${'c'.repeat(64)}');
      insert into orders
        (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAH', 'CO-2026-000001',
                '01ARZ3NDEKTSV4RRFFQ69G5FAC', '01ARZ3NDEKTSV4RRFFQ69G5FAD',
                '01ARZ3NDEKTSV4RRFFQ69G5FAB', '01ARZ3NDEKTSV4RRFFQ69G5FAG', 'confirmed', 1);
      insert into invoices
        (id, order_id, client_id, status, version, created_at, updated_at)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAJ', '01ARZ3NDEKTSV4RRFFQ69G5FAH',
                '01ARZ3NDEKTSV4RRFFQ69G5FAB', 'draft', 1, 1, 1);
      insert into invoice_revisions
        (id, invoice_id, version, invoice_number, issued_at, client_display_name, title,
         service_date, due_date, payment_terms, currency, net_total_cents, vat_total_cents,
         total_cents, created_at, created_by_user_id, template_id, template_version,
         render_snapshot)
        values ('01ARZ3NDEKTSV4RRFFQ69G5FAK', '01ARZ3NDEKTSV4RRFFQ69G5FAJ', 1, null, null,
                'Client', 'Invoice', '2026-08-20', '2026-09-20', '', 'EUR', 10000, 2000,
                12000, 1, '01ARZ3NDEKTSV4RRFFQ69G5FAA', 'invoice-default', 2,
                '{"templateVersion":2}');
    `);
    sqlite.close();

    await cp(join(sourceFolder, snapshotMigration), join(migrationsFolder, snapshotMigration), {
      recursive: true,
    });
    const snapshots = await Effect.runPromise(
      Database.use(({ sqlite: connection }) =>
        Effect.sync(() => ({
          invoice: connection
            .prepare(
              `select template_version as templateVersion,
                      json_extract(render_snapshot, '$.templateVersion') as snapshotVersion,
                      json_extract(render_snapshot, '$.orderReference') as orderReference,
                      json_extract(render_snapshot, '$.quoteReference') as quoteReference
               from invoice_revisions`,
            )
            .get(),
          quote: connection
            .prepare(
              `select template_version as templateVersion,
                      json_extract(render_snapshot, '$.templateVersion') as snapshotVersion,
                      json_extract(render_snapshot, '$.quoteReference') as quoteReference
               from quote_revisions`,
            )
            .get(),
        })),
      ).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );

    expect(snapshots).toEqual({
      invoice: {
        templateVersion: 1,
        snapshotVersion: 1,
        orderReference: 'CO-2026-000001',
        quoteReference: 'DE-2026-000001',
      },
      quote: {
        templateVersion: 1,
        snapshotVersion: 1,
        quoteReference: 'DE-2026-000001',
      },
    });
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
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      ).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
        Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
    const accessRevocationMigration = '20260822093637_revoke_disabled_user_access';
    await cp(
      join(sourceFolder, accessRevocationMigration),
      join(migrationsFolder, accessRevocationMigration),
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
      ).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
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
      ).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );

    expect(state.clientId).toBe(clientId);
    expect(state.revisionId).toBe(revisionId);
    expect(state.foreignKeyViolations).toEqual([]);
  });

  it('enforces immutable publications, business relationships, and invoice values', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-integrity-'));
    directories.push(directory);
    const filename = join(directory, 'database.sqlite');
    const migrationsFolder = join(import.meta.dirname, '..', 'drizzle');

    await Effect.runPromise(
      Database.use(({ sqlite }) =>
        Effect.sync(() => {
          sqlite.exec(`
            insert into users (id, display_name, kind, created_at, updated_at) values
              ('01ARZ3NDEKTSV4RRFFQ69G5FAA', 'Administrator', 'administrator', 1, 1),
              ('01ARZ3NDEKTSV4RRFFQ69G5FAB', 'Client A', 'client', 1, 1),
              ('01ARZ3NDEKTSV4RRFFQ69G5FAC', 'Client B', 'client', 1, 1);
            insert into clients (id, created_at, updated_at) values
              ('01ARZ3NDEKTSV4RRFFQ69G5FAB', 1, 1),
              ('01ARZ3NDEKTSV4RRFFQ69G5FAC', 1, 1);
            insert into quotes (id, reference, client_id, status, version, created_at, updated_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAD', 'DE-1970-000001', '01ARZ3NDEKTSV4RRFFQ69G5FAB', 'accepted', 1, 1, 1);
            insert into quote_revisions
              (id, quote_id, version, client_display_name, title, conditions, currency,
               net_total_cents, vat_total_cents, total_cents, created_at, created_by_user_id)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAE', '01ARZ3NDEKTSV4RRFFQ69G5FAD', 1,
                      'Client A', 'Quote', '', 'EUR', 0, 0, 0, 1,
                      '01ARZ3NDEKTSV4RRFFQ69G5FAA');
            insert into quote_lines
              (id, revision_id, position, description, quantity_milli, unit_price_cents,
               vat_rate_basis_points, net_total_cents, vat_total_cents, total_cents)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAF', '01ARZ3NDEKTSV4RRFFQ69G5FAE', 0,
                      'Service', 1000, 0, 0, 0, 0, 0);
            insert into document_artifacts
              (id, revision_id, kind, content_type, byte_size, sha256, content, created_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAG', '01ARZ3NDEKTSV4RRFFQ69G5FAE',
                      'quote-pdf', 'application/pdf', 1,
                      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
                      x'61', 1);
            insert into quote_links (id, revision_id, token_hmac, created_at, expires_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAH', '01ARZ3NDEKTSV4RRFFQ69G5FAE', zeroblob(32), 1, 2);
            insert into audit_events
              (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAJ', 'quote.accepted', null, 'quote',
                      '01ARZ3NDEKTSV4RRFFQ69G5FAD', 1, '{}');
            insert into quote_signatures
              (id, quote_id, revision_id, link_id, signer_name, consent, signature_kind,
               signature_value, signed_at, ip_address, user_agent, snapshot_sha256, pdf_sha256,
               audit_event_id, evidence_content, evidence_sha256)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAK', '01ARZ3NDEKTSV4RRFFQ69G5FAD',
                      '01ARZ3NDEKTSV4RRFFQ69G5FAE', '01ARZ3NDEKTSV4RRFFQ69G5FAH', 'Client A',
                      1, 'typed', 'Client A', 1, '127.0.0.1', '', '${'a'.repeat(64)}',
                      '${'b'.repeat(64)}', '01ARZ3NDEKTSV4RRFFQ69G5FAJ', x'61', '${'c'.repeat(64)}');
            insert into orders (id, reference, quote_id, revision_id, client_id, signature_id, status, created_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAM', 'CO-1970-000001', '01ARZ3NDEKTSV4RRFFQ69G5FAD',
                      '01ARZ3NDEKTSV4RRFFQ69G5FAE', '01ARZ3NDEKTSV4RRFFQ69G5FAB',
                       '01ARZ3NDEKTSV4RRFFQ69G5FAK', 'confirmed', 1);
            insert into document_artifacts
              (id, order_id, kind, content_type, byte_size, sha256, content, created_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAS', '01ARZ3NDEKTSV4RRFFQ69G5FAM',
                      'order-pdf', 'application/pdf', 1,
                      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
                      x'61', 1);
            insert into invoices (id, order_id, client_id, status, version, created_at, updated_at)
              values ('01ARZ3NDEKTSV4RRFFQ69G5FAP', '01ARZ3NDEKTSV4RRFFQ69G5FAM',
                      '01ARZ3NDEKTSV4RRFFQ69G5FAB', 'draft', 1, 1, 1);
          `);

          expect(() =>
            sqlite.prepare("update document_artifacts set content = x'62'").run(),
          ).toThrow('document artifacts are immutable');
          expect(() =>
            sqlite
              .prepare(
                `insert into document_artifacts
                 (id, revision_id, order_id, kind, content_type, byte_size, sha256, content, created_at)
                 values (?, ?, ?, 'order-pdf', 'application/pdf', 1, ?, x'61', 1)`,
              )
              .run(
                '01ARZ3NDEKTSV4RRFFQ69G5FAT',
                '01ARZ3NDEKTSV4RRFFQ69G5FAE',
                '01ARZ3NDEKTSV4RRFFQ69G5FAM',
                'a'.repeat(64),
              ),
          ).toThrow();
          expect(() => sqlite.prepare('delete from document_artifacts').run()).toThrow(
            'document artifacts are immutable',
          );
          expect(() =>
            sqlite.prepare("update quote_revisions set title = 'Changed'").run(),
          ).toThrow('published quote revisions are immutable');
          expect(() =>
            sqlite.prepare("update quote_lines set description = 'Changed'").run(),
          ).toThrow('published quote lines are immutable');
          expect(() =>
            sqlite
              .prepare(
                `insert into orders (id, quote_id, revision_id, client_id, signature_id, status, created_at)
                 values (?, ?, ?, ?, ?, 'confirmed', 1)`,
              )
              .run(
                '01ARZ3NDEKTSV4RRFFQ69G5FAM',
                '01ARZ3NDEKTSV4RRFFQ69G5FAD',
                '01ARZ3NDEKTSV4RRFFQ69G5FAE',
                '01ARZ3NDEKTSV4RRFFQ69G5FAC',
                '01ARZ3NDEKTSV4RRFFQ69G5FAK',
              ),
          ).toThrow('order business relationship violation');
          expect(() =>
            sqlite
              .prepare(
                `insert into invoices
                 (id, order_id, client_id, status, version, created_at, updated_at)
                 values (?, ?, ?, 'draft', 1, 1, 1)`,
              )
              .run(
                '01ARZ3NDEKTSV4RRFFQ69G5FAQ',
                '01ARZ3NDEKTSV4RRFFQ69G5FAM',
                '01ARZ3NDEKTSV4RRFFQ69G5FAC',
              ),
          ).toThrow('invoice business relationship violation');
          expect(() =>
            sqlite
              .prepare(
                `update invoices set status = 'issued', invoice_number = 'F-123456oops',
                                     issued_at = 2 where id = ?`,
              )
              .run('01ARZ3NDEKTSV4RRFFQ69G5FAP'),
          ).toThrow();
          expect(() =>
            sqlite
              .prepare(
                `insert into invoice_revisions
                 (id, invoice_id, version, client_display_name, title, service_date, due_date,
                  payment_terms, currency, net_total_cents, vat_total_cents, total_cents,
                  created_at, created_by_user_id, template_id, template_version, render_snapshot)
                 values (?, ?, 1, 'Client A', 'Invoice', '2026-02-31', '2026-03-31', '',
                         'EUR', 0, 0, 0, 1, ?, 'invoice-default', 1, '{}')`,
              )
              .run(
                '01ARZ3NDEKTSV4RRFFQ69G5FAN',
                '01ARZ3NDEKTSV4RRFFQ69G5FAP',
                '01ARZ3NDEKTSV4RRFFQ69G5FAA',
              ),
          ).toThrow();
        }),
      ).pipe(Effect.provide(makeMigratedDatabaseLayer({ filename, migrationsFolder }))),
    );
  });

  it('rejects invalid existing invoice data during the corrective migration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-corrective-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const correctiveMigration = '20260820125023_perfect_meggan';
    const previousMigrations = (await readdir(sourceFolder)).filter(
      (migration) => migration < correctiveMigration,
    );
    await Promise.all(
      previousMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    sqlite.pragma('foreign_keys = OFF');
    sqlite
      .prepare(
        `insert into invoices
         (id, order_id, client_id, status, version, invoice_number, issued_at, created_at, updated_at)
         values (?, ?, ?, 'issued', 1, 'F-123456oops', 2, 1, 2)`,
      )
      .run(
        '01ARZ3NDEKTSV4RRFFQ69G5FAA',
        '01ARZ3NDEKTSV4RRFFQ69G5FAB',
        '01ARZ3NDEKTSV4RRFFQ69G5FAC',
      );
    sqlite.close();
    await cp(join(sourceFolder, correctiveMigration), join(migrationsFolder, correctiveMigration), {
      recursive: true,
    });

    await expect(
      Effect.runPromise(
        Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
      ),
    ).rejects.toThrow();

    const failedSqlite = new Sqlite(filename);
    expect(
      failedSqlite
        .prepare('select count(*) from __drizzle_migrations where name = ?')
        .pluck()
        .get(correctiveMigration),
    ).toBe(0);
    expect(failedSqlite.prepare('select invoice_number from invoices').pluck().get()).toBe(
      'F-123456oops',
    );
    failedSqlite.close();
  });

  it('rejects a corrupt existing artifact before applying migrations', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-artifact-audit-'));
    directories.push(directory);
    const migrationsFolder = join(directory, 'drizzle');
    const sourceFolder = join(import.meta.dirname, '..', 'drizzle');
    const correctiveMigration = '20260820125023_perfect_meggan';
    const previousMigrations = (await readdir(sourceFolder)).filter(
      (migration) => migration !== correctiveMigration,
    );
    await Promise.all(
      previousMigrations.map((migration) =>
        cp(join(sourceFolder, migration), join(migrationsFolder, migration), { recursive: true }),
      ),
    );
    const filename = join(directory, 'database.sqlite');
    const options = { filename, migrationsFolder };
    await Effect.runPromise(
      Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
    );

    const sqlite = new Sqlite(filename);
    sqlite.pragma('foreign_keys = OFF');
    sqlite
      .prepare(
        `insert into document_artifacts
         (id, revision_id, kind, content_type, byte_size, sha256, content, created_at)
         values (?, ?, 'quote-pdf', 'application/pdf', 1, ?, x'61', 1)`,
      )
      .run('01ARZ3NDEKTSV4RRFFQ69G5FAA', '01ARZ3NDEKTSV4RRFFQ69G5FAB', '0'.repeat(64));
    sqlite.close();
    await cp(join(sourceFolder, correctiveMigration), join(migrationsFolder, correctiveMigration), {
      recursive: true,
    });

    await expect(
      Effect.runPromise(
        Database.use(() => Effect.void).pipe(Effect.provide(makeMigratedDatabaseLayer(options))),
      ),
    ).rejects.toThrow();

    const failedSqlite = new Sqlite(filename);
    expect(
      failedSqlite
        .prepare('select count(*) from __drizzle_migrations where name = ?')
        .pluck()
        .get(correctiveMigration),
    ).toBe(0);
    expect(failedSqlite.prepare('select sha256 from document_artifacts').pluck().get()).toBe(
      '0'.repeat(64),
    );
    failedSqlite.close();
  });

  it('rolls back migration data and journal rows after a foreign key violation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'froment-database-rollback-'));
    directories.push(directory);
    const filename = join(directory, 'database.sqlite');
    const migrationsFolder = join(
      import.meta.dirname,
      'fixtures',
      'invalid-foreign-key-migrations',
    );

    await expect(
      Effect.runPromise(
        Database.use(() => Effect.void).pipe(
          Effect.provide(makeMigratedDatabaseLayer({ filename, migrationsFolder })),
        ),
      ),
    ).rejects.toThrow();

    const sqlite = new Sqlite(filename);
    expect(
      sqlite
        .prepare("select name from sqlite_master where type = 'table' order by name")
        .pluck()
        .all(),
    ).toEqual([]);
    sqlite.close();
  });
});
