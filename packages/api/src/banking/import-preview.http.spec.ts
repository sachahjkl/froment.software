import {
  BankImportPreview,
  BankTransaction,
  BankTransactionList,
  LedgerEntry,
  LedgerList,
  LedgerSourceDetail,
} from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startHttpTestServer } from '../server/server.spec-helper.js';

type BankRequestBody = Readonly<Record<string, string>>;

describe('bank import preview HTTP', () => {
  it('validates the complete statement without writing transactions or audit events', async () => {
    const server = await startHttpTestServer();
    try {
      const post = (path: string, body: BankRequestBody) =>
        fetch(`${server.baseUrl}${path}`, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify(body),
        });
      const header = 'transaction_id,booked_on,amount,currency,description\n';
      const request = {
        account: 'Main',
        csv: `\uFEFF${header}BANK-1,2026-09-01,100.00,EUR,"Règlement\nclient"\nBANK-2,2026-09-01,-12.34,EUR,"Frais, banque"`,
      };
      const previewResponse = await post('/api/banking/import/preview', request);
      expect(previewResponse.status).toBe(200);
      expect(previewResponse.headers.get('cache-control')).toContain('no-store');
      const preview = Schema.decodeUnknownSync(BankImportPreview)(await previewResponse.json());
      expect(preview).toMatchObject({ added: 2, existing: 0 });
      expect(preview.rows).toMatchObject([
        { amountCents: 10000, description: 'Règlement\nclient', existing: false },
        { amountCents: -1234, description: 'Frais, banque', existing: false },
      ]);
      const list = async () =>
        Schema.decodeUnknownSync(BankTransactionList)(
          await (
            await fetch(`${server.baseUrl}/api/banking/transactions`, {
              headers: server.sessionHeaders,
            })
          ).json(),
        );
      expect(await list()).toEqual([]);
      const database = new Sqlite(server.databaseFilename);
      try {
        expect(
          database
            .prepare("select count(*) as count from audit_events where action = 'bank.imported'")
            .get(),
        ).toEqual({ count: 0 });
      } finally {
        database.close();
      }
      expect(await (await post('/api/banking/import', request)).json()).toEqual({
        added: 2,
        existing: 0,
      });
      expect(await (await post('/api/banking/import/preview', request)).json()).toMatchObject({
        added: 0,
        existing: 2,
      });
      const conflicting = {
        account: 'Main',
        csv: `${header}NEW,2026-09-01,1.00,EUR,New\nBANK-1,2026-09-01,200.00,EUR,Changed`,
      };
      expect((await post('/api/banking/import/preview', conflicting)).status).toBe(422);
      expect((await post('/api/banking/import', conflicting)).status).toBe(422);
      expect(await list()).toHaveLength(2);
      expect(
        (
          await post('/api/banking/import/preview', {
            ...request,
            csv: `${header}BAD,2026-02-30,1.001,EUR,Invalid`,
          })
        ).status,
      ).toBe(422);
      const unauthorized = await fetch(`${server.baseUrl}/api/banking/import/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: server.baseUrl },
        body: JSON.stringify(request),
      });
      expect(unauthorized.status).toBe(401);
      const hostile = await fetch(`${server.baseUrl}/api/banking/import/preview`, {
        method: 'POST',
        headers: { ...server.jsonHeaders, origin: 'https://untrusted.example' },
        body: JSON.stringify(request),
      });
      expect(hostile.status).toBe(403);
      const permissionsDatabase = new Sqlite(server.databaseFilename);
      try {
        permissionsDatabase
          .prepare("delete from role_permissions where permission_code = 'bank.import'")
          .run();
        const denied = await post('/api/banking/import/preview', request);
        expect(denied.status).toBe(403);
        expect(await denied.json()).toEqual({
          _tag: 'PermissionDenied',
          code: 'authentication.permission_denied',
        });
        expect(await list()).toHaveLength(2);
        expect(
          permissionsDatabase.prepare('select count(*) from integration_operations').pluck().get(),
        ).toBe(0);
      } finally {
        permissionsDatabase.close();
      }
    } finally {
      await server.close();
    }
  }, 20000);
  it('reads transactions, sources and preserved entries by identifier independently of period filters', async () => {
    const server = await startHttpTestServer();
    try {
      const post = (path: string, body: BankRequestBody) =>
        fetch(`${server.baseUrl}${path}`, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify(body),
        });
      const get = (path: string) =>
        fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
      expect(
        (
          await post('/api/banking/import', {
            account: 'Main',
            csv: 'transaction_id,booked_on,amount,currency,description\nDEBIT,2026-09-01,-12.34,EUR,Fee',
          })
        ).status,
      ).toBe(200);
      const transaction = Schema.decodeUnknownSync(BankTransactionList)(
        await (await get('/api/banking/transactions')).json(),
      )[0];
      if (!transaction) throw new Error('bank.test.transaction_missing');
      const detailResponse = await get(`/api/banking/transactions/${transaction.id}`);
      expect(detailResponse.headers.get('cache-control')).toContain('no-store');
      expect(Schema.decodeUnknownSync(BankTransaction)(await detailResponse.json())).toEqual(
        transaction,
      );
      const sourceResponse = await get(`/api/banking/ledger/sources/debit/${transaction.id}`);
      const source = Schema.decodeUnknownSync(LedgerSourceDetail)(await sourceResponse.json());
      expect(source.transactionId).toBe(transaction.id);
      expect(source.source.amountCents).toBe(1234);
      const response = await post('/api/banking/ledger', {
        sourceKind: 'debit',
        sourceId: transaction.id,
        bookedOn: source.source.postingDate,
        debitAccount: '627',
        creditAccount: '512',
        label: 'Bank fee',
        requestId: randomUUID(),
      });
      expect(response.status).toBe(200);
      const entry = Schema.decodeUnknownSync(LedgerEntry)(await response.json());
      expect(
        Schema.decodeUnknownSync(LedgerEntry)(
          await (await get(`/api/banking/ledger/entries/${entry.id}`)).json(),
        ),
      ).toEqual(entry);
      const reverseResponse = await post(`/api/banking/ledger/${entry.id}/reverse`, {
        reason: 'Wrong account',
        bookedOn: '2026-09-01',
        requestId: randomUUID(),
      });
      expect(reverseResponse.status).toBe(200);
      const reversal = Schema.decodeUnknownSync(LedgerEntry)(await reverseResponse.json());
      const preserved = Schema.decodeUnknownSync(LedgerEntry)(
        await (await get(`/api/banking/ledger/entries/${entry.id}`)).json(),
      );
      expect(preserved.reversalId).toBe(reversal.id);
      expect(preserved.label).toBe('Bank fee');
      const journal = Schema.decodeUnknownSync(LedgerList)(
        await (await get('/api/banking/ledger?from=2026-09-01&to=2026-09-01')).json(),
      );
      expect(journal.entries).toHaveLength(2);
      expect(journal.entries.every((entry) => entry.sourceReference === 'DEBIT')).toBe(true);
      expect((await fetch(`${server.baseUrl}/api/banking/ledger/entries/${entry.id}`)).status).toBe(
        401,
      );
      expect((await get(`/api/banking/transactions/${entry.id}`)).status).toBe(404);
      const sqlite = new Sqlite(server.databaseFilename);
      try {
        sqlite.prepare("delete from role_permissions where permission_code = 'bank.read'").run();
        const deniedTransaction = await get(`/api/banking/transactions/${transaction.id}`);
        expect(deniedTransaction.status).toBe(403);
        expect(await deniedTransaction.json()).toEqual({
          _tag: 'PermissionDenied',
          code: 'authentication.permission_denied',
        });
        expect((await get(`/api/banking/ledger/entries/${entry.id}`)).status).toBe(200);
        expect((await get(`/api/banking/ledger/sources/debit/${transaction.id}`)).status).toBe(200);
        sqlite.prepare("delete from role_permissions where permission_code = 'ledger.read'").run();
        for (const endpoint of [
          `/api/banking/ledger/entries/${entry.id}`,
          `/api/banking/ledger/sources/debit/${transaction.id}`,
        ]) {
          const denied = await get(endpoint);
          expect(denied.status).toBe(403);
          expect(await denied.json()).toEqual({
            _tag: 'PermissionDenied',
            code: 'authentication.permission_denied',
          });
        }
      } finally {
        sqlite.close();
      }
    } finally {
      await server.close();
    }
  }, 20000);
});
