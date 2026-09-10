import Sqlite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Effect } from 'effect';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { expect, it } from 'vitest';

import { Database } from '../database/database.js';
import {
  listCreditNotes,
  listInvoiceReceipts,
  listInvoiceRefunds,
  readInvoiceHistory,
} from './workspace.js';

it(
  'accepts 10000 rows and refuses larger results before decoding persisted rows',
  { timeout: 30_000 },
  async () => {
    const sqlite = new Sqlite(':memory:');
    try {
      // These reader fixtures contain only queried columns. HTTP tests use the migrated schema.
      sqlite.exec(`
      create table orders (id text primary key, reference text);
      create table invoices (
        id text primary key, invoice_number text, client_id text, order_id text, version integer
      );
      create table invoice_revisions (
        id text primary key, invoice_id text, version integer, title text, client_display_name text
      );
      create index invoice_revision_version on invoice_revisions (invoice_id, version);
      create table invoice_payments (
        id text primary key, invoice_id text, request_id text, expected_version integer,
        amount_cents integer, paid_on text, method text, reference text, recorded_at text,
        recorded_by_user_id text, cancelled_at text, cancelled_by_user_id text, cancellation_reason text
      );
      create table invoice_credit_notes (
        id text primary key, invoice_id text unique, invoice_revision_id text, request_id text,
        number text, reason text, issued_at text, issued_by_user_id text,
        net_total_cents integer, vat_total_cents integer, total_cents integer
      );
      create table invoice_refunds (
        id text primary key, invoice_id text, request_id text, amount_cents integer, refunded_on text,
        reference text, recorded_at text, recorded_by_user_id text,
        cancelled_at text, cancelled_by_user_id text, cancellation_reason text
      );
      create table document_artifacts (id text primary key, invoice_revision_id text);
      create table audit_events (
        id text primary key, action text, actor_user_id text, resource_type text, resource_id text,
        request_id text, trace_id text, span_id text, occurred_at integer, metadata text
      );
    `);
      const actorId = ulid();
      const clientId = ulid();
      const orderId = ulid();
      const historyInvoiceId = ulid();
      const documentId = ulid();
      const historyRevisionId = ulid();
      sqlite.prepare('insert into orders values (?, ?)').run(orderId, 'CO-2026-000001');
      const insertInvoice = sqlite.prepare('insert into invoices values (?, ?, ?, ?, 1)');
      const insertRevision = sqlite.prepare(
        "insert into invoice_revisions values (?, ?, 1, 'Invoice', 'Client')",
      );
      insertInvoice.run(historyInvoiceId, 'FA-2026-000000', clientId, orderId);
      insertRevision.run(historyRevisionId, historyInvoiceId);
      sqlite
        .prepare('insert into document_artifacts values (?, ?)')
        .run(documentId, historyRevisionId);
      const insertReceipt = sqlite.prepare(`insert into invoice_payments
      values (?, ?, ?, 1, ?, '2026-09-01', 'transfer', 'BANK',
        '2026-09-01T12:00:00.000Z', ?, null, null, null)`);
      const insertCredit = sqlite.prepare(`insert into invoice_credit_notes
      values (?, ?, ?, ?, ?, 'Cancelled service', '2026-09-01T12:00:00.000Z', ?, ?, 0, ?)`);
      const insertRefund = sqlite.prepare(`insert into invoice_refunds
      values (?, ?, ?, ?, '2026-09-01', 'REFUND',
        '2026-09-01T12:00:00.000Z', ?, null, null, null)`);
      const insertEvent = sqlite.prepare(`insert into audit_events
      values (?, ?, ?, ?, ?, null, null, null, ?, ?)`);
      const insertRows = (index: number, invalid = false) => {
        const invoiceId = ulid();
        const revisionId = ulid();
        const suffix = String(index + 1).padStart(6, '0');
        const amountCents = invalid ? -1 : 1;
        insertInvoice.run(invoiceId, `FA-2026-${suffix}`, clientId, orderId);
        insertRevision.run(revisionId, invoiceId);
        insertReceipt.run(ulid(), invoiceId, randomUUID(), amountCents, actorId);
        insertCredit.run(
          ulid(),
          invoiceId,
          revisionId,
          randomUUID(),
          `AV-2026-${suffix}`,
          actorId,
          amountCents,
          amountCents,
        );
        insertRefund.run(ulid(), invoiceId, randomUUID(), amountCents, actorId);
        const documentEvent = index % 2 === 0;
        insertEvent.run(
          ulid(),
          documentEvent ? 'document.rendered' : 'invoice.revised',
          actorId,
          documentEvent ? 'document' : 'invoice',
          documentEvent ? documentId : historyInvoiceId,
          1_788_000_000_000 + index,
          invalid ? 'invalid JSON' : '{}',
        );
      };
      sqlite
        .transaction(() => {
          for (let index = 0; index < 10000; index++) insertRows(index);
        })
        .immediate();

      await Effect.gen(function* () {
        const receipts = yield* listInvoiceReceipts();
        const credits = yield* listCreditNotes();
        const refunds = yield* listInvoiceRefunds();
        const history = yield* readInvoiceHistory(historyInvoiceId);
        for (const rows of [receipts, credits, refunds, history]) expect(rows).toHaveLength(10000);
        expect(receipts.reduce((sum, row) => sum + BigInt(row.amountCents), 0n)).toBe(10000n);
        expect(credits.reduce((sum, row) => sum + BigInt(row.totalCents), 0n)).toBe(10000n);
        expect(refunds.reduce((sum, row) => sum + BigInt(row.amountCents), 0n)).toBe(10000n);
        expect(history.filter((event) => event.resourceType === 'document')).toHaveLength(5000);

        sqlite.transaction(() => insertRows(10000, true)).immediate();
        for (const read of [
          listInvoiceReceipts().pipe(Effect.asVoid),
          listCreditNotes().pipe(Effect.asVoid),
          listInvoiceRefunds().pipe(Effect.asVoid),
          readInvoiceHistory(historyInvoiceId).pipe(Effect.asVoid),
        ]) {
          expect(yield* Effect.result(read)).toMatchObject({
            _tag: 'Failure',
            failure: { _tag: 'InvoiceWorkspaceLimitExceeded', code: 'invoice.workspace_limit' },
          });
        }
      }).pipe(
        Effect.provideService(Database, Database.of({ sqlite, orm: drizzle({ client: sqlite }) })),
        Effect.runPromise,
      );
    } finally {
      sqlite.close();
    }
  },
);
