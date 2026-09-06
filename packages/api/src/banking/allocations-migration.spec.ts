import Sqlite from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('preserves active and cancelled historical matches with their original amounts and actors', () => {
  const sqlite = new Sqlite(':memory:');
  try {
    sqlite.exec(
      'create table users (id text primary key); create table invoice_payments (id text primary key, amount_cents integer not null);',
    );
    sqlite.exec(
      readFileSync(
        join(import.meta.dirname, '../../drizzle/20260906120019_bank_transactions/migration.sql'),
        'utf8',
      ),
    );
    sqlite.exec(
      "insert into users values ('actor'); insert into invoice_payments values ('receipt', 10000);",
    );
    sqlite.exec(
      "insert into bank_transactions values ('credit', 'MAIN', 'A', '2026-09-01', 10000, 'Test', '2026-09-01T00:00:00.000Z', 'actor');",
    );
    sqlite.exec(
      "insert into bank_matches values ('active', 'credit', 'receipt', '2026-09-01T00:00:00.000Z', 'actor', null, null, null);",
    );
    sqlite.exec(
      "insert into bank_matches values ('cancelled', 'credit', 'receipt', '2026-09-01T00:00:00.000Z', 'actor', '2026-09-02T00:00:00.000Z', 'actor', 'Correction');",
    );
    const before = sqlite.prepare('select * from bank_matches order by id').all();
    sqlite.exec(
      readFileSync(
        join(import.meta.dirname, '../../drizzle/20260906180848_bank_allocations/migration.sql'),
        'utf8',
      ),
    );
    expect(
      sqlite
        .prepare(
          'select id, transaction_id, payment_id, matched_at, matched_by_user_id, cancelled_at, cancelled_by_user_id, cancellation_reason from bank_matches order by id',
        )
        .all(),
    ).toEqual(before);
    expect(
      sqlite.prepare('select request_id, amount_cents from bank_matches order by id').all(),
    ).toEqual([
      { request_id: 'active', amount_cents: 10000 },
      { request_id: 'cancelled', amount_cents: 10000 },
    ]);
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([]);
  } finally {
    sqlite.close();
  }
});
