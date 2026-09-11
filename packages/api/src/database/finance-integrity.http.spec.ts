import { BankTransactionList, InvoiceDetail } from '@froment/contracts';
import { Effect, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { Database, makeDatabaseLayer } from './database.js';
import {
  acceptQuote,
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('preserves financial records against SQL changes and permits normal cancellation and settlement', async () => {
  const server = await startHttpTestServer();
  const post = (path: string, payload: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(payload),
    });
  const get = async (path: string) =>
    (await fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders })).json();
  const inspect = (check: (sqlite: Database['Service']['sqlite']) => void) =>
    Effect.runPromise(
      Database.use(({ sqlite }) => Effect.sync(() => check(sqlite))).pipe(
        Effect.provide(makeDatabaseLayer({ filename: server.databaseFilename })),
      ),
    );
  try {
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    const draft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: 'Test',
        })
      ).json(),
    );
    const path = `/api/invoices/${draft.id}`;
    expect((await post(`${path}/issue`, { expectedVersion: draft.version })).status).toBe(200);
    const issued = Schema.decodeUnknownSync(InvoiceDetail)(await get(path));
    const paymentRequest = {
      requestId: randomUUID(),
      expectedVersion: issued.version,
      amountCents: issued.currentRevision.totalCents,
      paidOn: '2026-09-01',
      method: 'transfer',
      reference: 'TEST-RECEIPT',
    };
    const paid = Schema.decodeUnknownSync(InvoiceDetail)(
      await (await post(`${path}/payments`, paymentRequest)).json(),
    );
    expect(paid.status).toBe('paid');
    const payment = paid.payments[0];
    if (!payment) throw new Error('finance.test.payment_missing');
    expect(
      (
        await post('/api/banking/import', {
          account: 'TEST',
          csv: `transaction_id,booked_on,amount,currency,description\nTEST,2026-09-01,${(payment.amountCents / 100).toFixed(2)},EUR,Test receipt`,
        })
      ).status,
    ).toBe(200);
    const transaction = Schema.decodeUnknownSync(BankTransactionList)(
      await get('/api/banking/transactions'),
    )[0];
    if (!transaction) throw new Error('finance.test.transaction_missing');
    const bankPath = `/api/banking/transactions/${transaction.id}`;
    const matchRequest = {
      requestId: randomUUID(),
      paymentId: payment.id,
      amountCents: payment.amountCents,
      feeCents: 0,
    };
    const matched = Schema.decodeUnknownSync(BankTransactionList)(
      await (await post(`${bankPath}/match`, matchRequest)).json(),
    );
    const match = matched[0]?.allocations[0];
    if (!match) throw new Error('finance.test.match_missing');

    await inspect((sqlite) => {
      expect(sqlite.pragma('recursive_triggers', { simple: true })).toBe(1);
      const quoteRevisionId = Schema.decodeUnknownSync(Schema.String)(
        sqlite.prepare('select revision_id from orders where id = ?').pluck().get(accepted.orderId),
      );
      const cancellation =
        "cancelled_at = '2099-01-01T00:00:00.000Z', cancelled_by_user_id = ?, cancellation_reason = 'Test correction'";
      const paymentRow = sqlite
        .prepare('select * from invoice_payments where id = ?')
        .get(payment.id);
      const matchRow = sqlite.prepare('select * from bank_matches where id = ?').get(match.matchId);
      const header = sqlite.prepare('select * from invoices where id = ?').get(issued.id);
      const paymentChanges: ReadonlyArray<readonly [string, string | number]> = [
        ['id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['invoice_id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['request_id', randomUUID()],
        ['expected_version', 99],
        ['amount_cents', 1],
        ['paid_on', '2026-08-31'],
        ['method', 'cash'],
        ['reference', 'Changed'],
        ['recorded_at', '2026-01-01T00:00:00.000Z'],
        ['recorded_by_user_id', client.id],
      ];
      for (const [column, value] of paymentChanges) {
        expect(() =>
          sqlite
            .prepare(`update invoice_payments set ${cancellation}, ${column} = ? where id = ?`)
            .run(payment.recordedByUserId, value, payment.id),
        ).toThrow('invoice_payments_immutable');
      }
      const matchChanges: ReadonlyArray<readonly [string, string | number]> = [
        ['id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['request_id', randomUUID()],
        ['transaction_id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['payment_id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['amount_cents', 1],
        ['fee_cents', 1],
        ['matched_at', '2026-01-01T00:00:00.000Z'],
        ['matched_by_user_id', client.id],
      ];
      for (const [column, value] of matchChanges) {
        expect(() =>
          sqlite
            .prepare(`update bank_matches set ${cancellation}, ${column} = ? where id = ?`)
            .run(payment.recordedByUserId, value, match.matchId),
        ).toThrow('bank_matches_immutable');
      }
      for (const [table, id] of [
        ['invoice_payments', payment.id],
        ['bank_matches', match.matchId],
      ] as const) {
        for (const partial of [
          "cancelled_at = '2099-01-01T00:00:00.000Z'",
          "cancellation_reason = 'Test'",
        ]) {
          expect(() =>
            sqlite.prepare(`update ${table} set ${partial} where id = ?`).run(id),
          ).toThrow(`${table}_immutable`);
        }
        for (const invalid of [
          'cancelled_at = null',
          'cancelled_by_user_id = null',
          "cancellation_reason = ' '",
          'cancellation_reason = null',
          "cancelled_at = '1900-01-01T00:00:00.000Z'",
        ]) {
          expect(() =>
            sqlite
              .prepare(`update ${table} set ${cancellation}, ${invalid} where id = ?`)
              .run(payment.recordedByUserId, id),
          ).toThrow(`${table}_immutable`);
        }
        expect(() => sqlite.prepare(`delete from ${table} where id = ?`).run(id)).toThrow(
          `${table}_immutable`,
        );
      }
      const headerChanges: ReadonlyArray<readonly [string, string | number | null]> = [
        ['id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['order_id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['client_id', '01ARZ3NDEKTSV4RRFFQ69G5FAA'],
        ['version', issued.version + 1],
        ['invoice_number', 'FA-2026-999999'],
        ['invoice_number', null],
        ['issued_at', 1],
        ['issued_at', null],
        ['created_at', 1],
        ['paid_at', 1],
      ];
      for (const [column, value] of headerChanges) {
        expect(() =>
          sqlite.prepare(`update invoices set ${column} = ? where id = ?`).run(value, issued.id),
        ).toThrow('issued_invoices_immutable');
      }
      expect(() =>
        sqlite
          .prepare(
            "update invoices set status = 'draft', invoice_number = null, issued_at = null, paid_at = null where id = ?",
          )
          .run(issued.id),
      ).toThrow('issued_invoices_immutable');
      expect(() => sqlite.prepare('delete from invoices where id = ?').run(issued.id)).toThrow(
        'issued_invoices_immutable',
      );
      expect(() =>
        sqlite
          .prepare(
            "update bank_transactions set amount_cents = 1, reference = 'Changed' where id = ?",
          )
          .run(transaction.id),
      ).toThrow('bank_transactions_immutable');
      expect(() =>
        sqlite.prepare('delete from bank_transactions where id = ?').run(transaction.id),
      ).toThrow('bank_transactions_immutable');

      for (const [table, id] of [
        ['invoice_payments', payment.id],
        ['bank_matches', match.matchId],
        ['bank_transactions', transaction.id],
        ['invoices', issued.id],
        ['invoice_revisions', issued.currentRevision.id],
        ['quote_revisions', quoteRevisionId],
      ] as const) {
        const before = sqlite.prepare(`select * from ${table} where id = ?`).get(id);
        expect(before).toBeDefined();
        expect(() =>
          sqlite
            .prepare(`insert or replace into ${table} select * from ${table} where id = ?`)
            .run(id),
        ).toThrow('database.trigger.');
        const columns = Schema.decodeUnknownSync(
          Schema.Array(Schema.Struct({ name: Schema.String })),
        )(sqlite.prepare(`pragma table_info(${table})`).all()).map(({ name }) => name);
        const replacements = columns.map((column) =>
          column === 'id' ? "'01ARZ3NDEKTSV4RRFFQ69G5FAA'" : `"${column}"`,
        );
        expect(() =>
          sqlite
            .prepare(
              `insert or replace into ${table} (${columns.map((column) => `"${column}"`).join(', ')}) select ${replacements.join(', ')} from ${table} where id = ?`,
            )
            .run(id),
        ).toThrow('database.trigger.');
        expect(sqlite.prepare(`select * from ${table} where id = ?`).get(id)).toEqual(before);
      }
      expect(sqlite.prepare('select * from invoice_payments where id = ?').get(payment.id)).toEqual(
        paymentRow,
      );
      expect(sqlite.prepare('select * from bank_matches where id = ?').get(match.matchId)).toEqual(
        matchRow,
      );
      expect(sqlite.prepare('select * from invoices where id = ?').get(issued.id)).toEqual(header);
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    });

    const cancellationRequest = { matchId: match.matchId, reason: 'Test correction' };
    expect((await post(`${bankPath}/unmatch`, cancellationRequest)).status).toBe(200);
    expect((await post(`${bankPath}/unmatch`, cancellationRequest)).status).toBe(200);
    const paymentCancellation = { expectedVersion: issued.version, reason: 'Test correction' };
    expect((await post(`${path}/payments/${payment.id}/cancel`, paymentCancellation)).status).toBe(
      200,
    );
    expect((await post(`${path}/payments/${payment.id}/cancel`, paymentCancellation)).status).toBe(
      200,
    );
    expect(Schema.decodeUnknownSync(InvoiceDetail)(await get(path)).status).toBe('issued');
    await inspect((sqlite) => {
      for (const [table, id] of [
        ['invoice_payments', payment.id],
        ['bank_matches', match.matchId],
      ] as const) {
        const before = sqlite.prepare(`select * from ${table} where id = ?`).get(id);
        for (const change of [
          'cancelled_at = null, cancelled_by_user_id = null, cancellation_reason = null',
          "cancellation_reason = 'Changed'",
          "cancelled_at = '2099-01-01T00:00:00.000Z'",
          'cancelled_by_user_id = null',
        ]) {
          expect(() =>
            sqlite.prepare(`update ${table} set ${change} where id = ?`).run(id),
          ).toThrow(`${table}_immutable`);
        }
        expect(sqlite.prepare(`select * from ${table} where id = ?`).get(id)).toEqual(before);
      }
    });
    const repaid = Schema.decodeUnknownSync(InvoiceDetail)(
      await (await post(`${path}/payments`, { ...paymentRequest, requestId: randomUUID() })).json(),
    );
    expect(repaid.status).toBe('paid');
    expect(repaid.version).toBe(issued.version);
    expect(repaid.currentRevision).toEqual(issued.currentRevision);
    const otherQuote = await createQuote(server, client.id);
    const otherOrder = await acceptQuote(server, otherQuote.id);
    const otherDraft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: otherOrder.accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: 'Test',
        })
      ).json(),
    );
    const otherPath = `/api/invoices/${otherDraft.id}`;
    expect((await post(`${otherPath}/issue`, { expectedVersion: otherDraft.version })).status).toBe(
      200,
    );
    const otherIssued = Schema.decodeUnknownSync(InvoiceDetail)(await get(otherPath));
    expect((await post(`${otherPath}/void`, { expectedVersion: otherIssued.version })).status).toBe(
      200,
    );
    expect(Schema.decodeUnknownSync(InvoiceDetail)(await get(otherPath)).status).toBe('void');
    await inspect((sqlite) => {
      expect(() =>
        sqlite
          .prepare("update invoices set status = 'issued', voided_at = null where id = ?")
          .run(otherDraft.id),
      ).toThrow('issued_invoices_immutable');
      expect(() =>
        sqlite.prepare('update invoices set voided_at = 1 where id = ?').run(otherDraft.id),
      ).toThrow('issued_invoices_immutable');
      expect(sqlite.pragma('foreign_key_check')).toEqual([]);
    });
  } finally {
    await server.close();
  }
}, 20000);
