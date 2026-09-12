import Sqlite from 'better-sqlite3';
import { DateTime, Schema } from 'effect';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('preserves existing issuer details and bank transactions when applying the finance migrations', () => {
  const sqlite = new Sqlite(':memory:');
  const migrations = readMigrationFiles({
    migrationsFolder: join(import.meta.dirname, '../../drizzle'),
  });
  const issuerMigration = migrations.findIndex((migration) =>
    migration.name.endsWith('_issuer_settings_version'),
  );
  const clientPhoneMigration = migrations.find((migration) =>
    migration.name.endsWith('_polite_mandrill'),
  );
  expect(issuerMigration).toBeGreaterThan(0);
  if (clientPhoneMigration === undefined) throw new Error('migration.client_phone_missing');
  const statementIndex = (text: string) =>
    clientPhoneMigration.sql.findIndex((statement) => statement.includes(text));
  const quoteDrop = statementIndex('DROP TRIGGER IF EXISTS `published_quote');
  const invoiceDrop = statementIndex('DROP TRIGGER IF EXISTS `invoice_revisions_no_update`');
  const quoteUpdate = statementIndex('UPDATE `quote_revisions`');
  const invoiceUpdate = statementIndex('UPDATE `invoice_revisions`');
  expect(quoteDrop).toBeGreaterThanOrEqual(0);
  expect(invoiceDrop).toBeGreaterThan(quoteDrop);
  expect(quoteUpdate).toBeGreaterThan(invoiceDrop);
  expect(invoiceUpdate).toBeGreaterThan(quoteUpdate);
  expect(statementIndex('CREATE TRIGGER `published_quote')).toBeGreaterThan(invoiceUpdate);
  expect(statementIndex('CREATE TRIGGER `invoice_revisions_no_update`')).toBeGreaterThan(
    invoiceUpdate,
  );
  try {
    sqlite.function('business_year', { deterministic: true }, (milliseconds: number) =>
      DateTime.toParts(
        DateTime.makeUnsafe(milliseconds).pipe(
          DateTime.setZone(DateTime.zoneMakeNamedUnsafe('Europe/Paris')),
        ),
      ).year.toString(),
    );
    sqlite.pragma('foreign_keys = OFF');
    sqlite.pragma('recursive_triggers = ON');
    for (const migration of migrations.slice(0, issuerMigration)) {
      for (const statement of migration.sql) sqlite.exec(statement);
    }
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec("update issuer_settings set vat_number = 'TEST-VAT', phone = 'TEST-PHONE'");
    sqlite.exec(
      "insert into users (id, display_name, kind, created_at, updated_at) values ('01ARZ3NDEKTSV4RRFFQ69G5FAA', 'Test', 'administrator', 1, 1)",
    );
    sqlite.exec(`insert into bank_transactions (id, account, reference, booked_on, amount_cents, description, imported_at, imported_by_user_id)
      values ('01ARZ3NDEKTSV4RRFFQ69G5FAB', 'TEST', 'TEST', '2026-08-31', -10000, 'Test', '2026-09-01T00:00:00.000Z', '01ARZ3NDEKTSV4RRFFQ69G5FAA')`);
    const bank = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(
      sqlite.prepare('select * from bank_transactions').get(),
    );
    const issuer = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(
      sqlite.prepare('select * from issuer_settings').get(),
    );
    for (const migration of migrations.slice(issuerMigration)) {
      for (const statement of migration.sql) sqlite.exec(statement);
    }
    expect(sqlite.prepare('select * from issuer_settings').get()).toMatchObject(issuer);
    expect(sqlite.prepare('select version from issuer_settings').pluck().get()).toBe(1);
    expect(sqlite.prepare('select * from bank_transactions').get()).toMatchObject(bank);
    expect(() => sqlite.exec('update issuer_settings set version = 0')).toThrow(
      'issuer_settings_version_check',
    );
    expect(() => sqlite.exec('update bank_transactions set amount_cents = -1')).toThrow(
      'bank_transactions_immutable',
    );
    expect(() =>
      sqlite.exec('insert or replace into bank_transactions select * from bank_transactions'),
    ).toThrow('bank_transactions_immutable');
    expect(sqlite.pragma('foreign_key_check')).toEqual([]);
  } finally {
    sqlite.close();
  }
});
