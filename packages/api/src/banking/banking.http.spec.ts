import { BankMatchHistory, BankTransactionList, InvoiceDetail } from '@froment/contracts';
import { randomUUID } from 'node:crypto';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  acceptQuote,
  createQuote,
  setIssuer,
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

describe('banking HTTP', () => {
  it('matches exact receipts, preserves cancellations, and rejects stale or duplicate matches', async () => {
    const server = await startHttpTestServer();
    try {
      await setIssuer(server);
      const client = await createClient(server);
      const quote = await createQuote(server, client.id);
      const { accepted } = await acceptQuote(server, quote.id);
      type RequestBody = Readonly<Record<string, string | number>>;
      const post = (path: string, body: RequestBody) =>
        fetch(`${server.baseUrl}${path}`, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify(body),
        });
      const created = await post('/api/invoices', {
        orderId: accepted.orderId,
        serviceDate: '2026-09-01',
        dueDate: '2026-10-01',
        paymentTerms: '30 days',
      });
      const invoice = Schema.decodeUnknownSync(InvoiceDetail)(await created.json());
      expect(
        (await post(`/api/invoices/${invoice.id}/issue`, { expectedVersion: invoice.version }))
          .status,
      ).toBe(200);
      const detailResponse = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}`, {
        headers: server.sessionHeaders,
      });
      const issued = Schema.decodeUnknownSync(InvoiceDetail)(await detailResponse.json());
      const paymentResponse = await post(`/api/invoices/${invoice.id}/payments`, {
        requestId: randomUUID(),
        expectedVersion: issued.version,
        amountCents: 10000,
        paidOn: '2026-09-01',
        method: 'transfer',
        reference: 'BANK-1',
      });
      const paid = Schema.decodeUnknownSync(InvoiceDetail)(await paymentResponse.json());
      const payment = paid.payments[0];
      if (payment === undefined) throw new Error('bank.payment.missing');
      expect(
        (
          await post('/api/banking/import', {
            account: 'Main',
            csv: 'transaction_id,booked_on,amount,currency,description\nBANK-1,2026-09-01,100.00,EUR,Receipt\nBANK-2,2026-09-01,100.00,EUR,Other\nBANK-3,2026-09-01,-100.00,EUR,Debit',
          })
        ).status,
      ).toBe(200);
      const list = async () =>
        Schema.decodeUnknownSync(BankTransactionList)(
          await (
            await fetch(`${server.baseUrl}/api/banking/transactions`, {
              headers: server.sessionHeaders,
            })
          ).json(),
        );
      const transactions = await list();
      const first = transactions.find((row) => row.reference === 'BANK-1');
      const second = transactions.find((row) => row.reference === 'BANK-2');
      const debit = transactions.find((row) => row.reference === 'BANK-3');
      if (first === undefined || second === undefined || debit === undefined)
        throw new Error('bank.transaction.missing');
      expect(
        (await post(`/api/banking/transactions/${debit.id}/match`, { paymentId: payment.id }))
          .status,
      ).toBe(409);
      expect(
        (await post(`/api/banking/transactions/${first.id}/match`, { paymentId: payment.id }))
          .status,
      ).toBe(200);
      expect(
        (await post(`/api/banking/transactions/${first.id}/match`, { paymentId: payment.id }))
          .status,
      ).toBe(200);
      expect(
        (await post(`/api/banking/transactions/${second.id}/match`, { paymentId: payment.id }))
          .status,
      ).toBe(409);
      const match = (await list()).find((row) => row.id === first.id);
      const historyUrl = `${server.baseUrl}/api/banking/transactions/${first.id}/history`;
      const readHistory = async () => {
        const response = await fetch(historyUrl, { headers: server.sessionHeaders });
        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        return Schema.decodeUnknownSync(BankMatchHistory)(await response.json());
      };
      expect(await readHistory()).toMatchObject([
        { paymentId: payment.id, invoiceId: invoice.id, cancelledAt: null },
      ]);
      expect((await fetch(historyUrl)).status).toBe(401);
      const clientHeaders = await createClientSession(server, client.id);
      expect((await fetch(historyUrl, { headers: clientHeaders })).status).toBe(403);
      expect(
        (
          await fetch(`${server.baseUrl}/api/banking/transactions/${invoice.id}/history`, {
            headers: server.sessionHeaders,
          })
        ).status,
      ).toBe(404);
      if (match?.matchId == null) throw new Error('bank.match.missing');
      expect(
        (
          await post(`/api/banking/transactions/${first.id}/unmatch`, {
            matchId: second.id,
            reason: 'Wrong match',
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await post(`/api/invoices/${invoice.id}/payments/${payment.id}/cancel`, {
            expectedVersion: paid.version,
            reason: 'Incorrect entry',
          })
        ).status,
      ).toBe(200);
      expect((await list()).find((row) => row.id === first.id)?.paymentCancelled).toBe(true);
      const cancel = { matchId: match.matchId, reason: 'Cancelled payment' };
      expect((await post(`/api/banking/transactions/${first.id}/unmatch`, cancel)).status).toBe(
        200,
      );
      expect((await post(`/api/banking/transactions/${first.id}/unmatch`, cancel)).status).toBe(
        200,
      );
      expect(
        (await post(`/api/banking/transactions/${first.id}/match`, { paymentId: payment.id }))
          .status,
      ).toBe(409);
      const database = new Sqlite(server.databaseFilename);
      const history = await readHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.cancellationReason).toBe('Cancelled payment');
      expect(history[0]?.cancelledAt).not.toBeNull();
      expect(history[0]?.cancelledByUserId).toBe(history[0]?.matchedByUserId);
      try {
        database.prepare("delete from role_permissions where permission_code = 'bank.read'").run();
        expect((await fetch(historyUrl, { headers: server.sessionHeaders })).status).toBe(403);
        expect(database.prepare('select count(*) as count from invoice_payments').get()).toEqual({
          count: 1,
        });
        expect(
          database.prepare('select cancellation_reason as reason from bank_matches').get(),
        ).toEqual({ reason: 'Cancelled payment' });
        expect(
          database
            .prepare("select count(*) as count from audit_events where action = 'bank.matched'")
            .get(),
        ).toEqual({ count: 1 });
        expect(
          database
            .prepare("select count(*) as count from audit_events where action = 'bank.unmatched'")
            .get(),
        ).toEqual({ count: 1 });
      } finally {
        database.close();
      }
    } finally {
      await server.close();
    }
  }, 20000);
  it('imports atomically, deduplicates by account and source reference, and protects statements', async () => {
    const server = await startHttpTestServer();
    try {
      const url = `${server.baseUrl}/api/banking`;
      const header = 'transaction_id,booked_on,amount,currency,description\n';
      const csv = `${header}BANK-1,2026-09-01,100.00,EUR,Receipt\nBANK-2,2026-09-01,-10.00,EUR,Fee`;
      const post = (csv: string, account = 'Main') =>
        fetch(`${url}/import`, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify({ account, csv }),
        });
      expect((await fetch(`${url}/transactions`)).status).toBe(401);
      const client = await createClient(server);
      const clientHeaders = await createClientSession(server, client.id);
      expect((await fetch(`${url}/transactions`, { headers: clientHeaders })).status).toBe(403);
      expect(
        (
          await fetch(`${url}/import`, {
            method: 'POST',
            headers: { ...server.jsonHeaders, origin: 'https://untrusted.example' },
            body: JSON.stringify({ account: 'Main', csv }),
          })
        ).status,
      ).toBe(403);
      expect(await (await post(csv)).json()).toEqual({ added: 2, existing: 0 });
      expect(await (await post(csv)).json()).toEqual({ added: 0, existing: 2 });
      expect(
        (
          await post(
            `${header}BANK-3,2026-09-01,1.00,EUR,New\nBANK-1,2026-09-01,200.00,EUR,Changed`,
          )
        ).status,
      ).toBe(422);
      const response = await fetch(`${url}/transactions`, { headers: server.sessionHeaders });
      expect(response.headers.get('cache-control')).toContain('no-store');
      const transactions = Schema.decodeUnknownSync(BankTransactionList)(await response.json());
      expect(transactions).toHaveLength(2);
      expect(transactions.every((row) => row.paymentId === null)).toBe(true);
      expect(await (await post(csv, 'Other')).json()).toEqual({ added: 2, existing: 0 });
      const database = new Sqlite(server.databaseFilename);
      try {
        database
          .prepare(
            "delete from role_permissions where permission_code in ('bank.import', 'bank.reconcile')",
          )
          .run();
        expect(
          (await fetch(`${url}/transactions`, { headers: server.sessionHeaders })).status,
        ).toBe(200);
        expect((await post(csv)).status).toBe(403);
        expect(
          (
            await fetch(`${url}/transactions/01ARZ3NDEKTSV4RRFFQ69G5FAV/match`, {
              method: 'POST',
              headers: server.jsonHeaders,
              body: JSON.stringify({ paymentId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }),
            })
          ).status,
        ).toBe(403);
        expect(
          database
            .prepare("select count(*) as count from audit_events where action = 'bank.imported'")
            .get(),
        ).toEqual({ count: 2 });
        expect(database.prepare('select count(*) as count from invoice_payments').get()).toEqual({
          count: 0,
        });
      } finally {
        database.close();
      }
    } finally {
      await server.close();
    }
  }, 20000);
});
