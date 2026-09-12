import {
  DefaultBankCsvConfiguration,
  ApiTokenCreated,
  BankTransactionList,
  InvoiceDetail,
  LedgerEntry,
  LedgerList,
} from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('posts balanced immutable debit entries once, reverses without deletion, and exports exact accounting lines', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const post = (path: string, payload: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(payload),
    });
  const get = (path: string) =>
    fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
  const ledgerPath = '/api/banking/ledger';
  const period = '?from=2026-08-31&to=2026-09-06';
  try {
    expect(
      (
        await post('/api/banking/import', {
          account: 'BANK',
          format: 'csv',
          csvConfiguration: DefaultBankCsvConfiguration,
          content:
            'transaction_id,booked_on,amount,currency,description\nD,2026-08-31,-12.34,EUR,Expense\nC,2026-08-31,12.34,EUR,Receipt',
        })
      ).status,
    ).toBe(200);
    const initial = Schema.decodeUnknownSync(LedgerList)(
      await (await get(ledgerPath + period)).json(),
    );
    expect(initial.entries).toEqual([]);
    expect(initial.sources).toHaveLength(1);
    const source = initial.sources[0];
    if (!source) throw new Error('ledger.test.source_missing');
    const request = {
      requestId: randomUUID(),
      sourceKind: 'debit',
      sourceId: source.sourceId,
      bookedOn: source.postingDate,
      debitAccount: '627',
      creditAccount: '512',
      label: '=Literal, "fee"',
    };
    expect((await post(ledgerPath, { ...request, creditAccount: '627' })).status).toBe(400);
    expect(
      (
        await fetch(server.baseUrl + ledgerPath, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: 'https://other.example' },
          body: JSON.stringify(request),
        })
      ).status,
    ).toBe(403);
    const concurrent = await Promise.all([
      post(ledgerPath, request),
      post(ledgerPath, { ...request, requestId: randomUUID() }),
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);
    const current = Schema.decodeUnknownSync(LedgerList)(
      await (await get(ledgerPath + period)).json(),
    );
    const entry = current.entries[0];
    if (!entry) throw new Error('ledger.test.entry_missing');
    expect(entry).toMatchObject({
      amountCents: 1234,
      bookedOn: '2026-08-31',
      debitAccount: '627',
      creditAccount: '512',
      reversesId: null,
    });
    expect(current.sources[0]?.entryId).toBe(entry.id);
    expect(entry.sourceReference).toBe('D');
    const retry = { ...request, requestId: entry.requestId };
    expect(
      Schema.decodeUnknownSync(LedgerEntry)(await (await post(ledgerPath, retry)).json()),
    ).toEqual(Schema.decodeUnknownSync(LedgerEntry)(entry));
    expect((await post(ledgerPath, { ...retry, label: 'Changed' })).status).toBe(409);
    const reversePath = `${ledgerPath}/${entry.id}/reverse`;
    const reverse = { requestId: randomUUID(), bookedOn: '2026-09-06', reason: 'Wrong account' };
    expect((await post(reversePath, { ...reverse, bookedOn: '2099-01-01' })).status).toBe(409);
    expect((await post(reversePath, { ...reverse, bookedOn: '2026-08-30' })).status).toBe(409);
    const reversed = Schema.decodeUnknownSync(LedgerEntry)(
      await (await post(reversePath, reverse)).json(),
    );
    expect(reversed).toMatchObject({
      reversesId: entry.id,
      amountCents: 1234,
      debitAccount: '512',
      creditAccount: '627',
      label: 'Wrong account',
    });
    expect(
      Schema.decodeUnknownSync(LedgerEntry)(await (await post(reversePath, reverse)).json()),
    ).toEqual(reversed);
    expect(
      (await post(`${ledgerPath}/${reversed.id}/reverse`, { ...reverse, requestId: randomUUID() }))
        .status,
    ).toBe(409);
    expect((await post(reversePath, { ...reverse, requestId: randomUUID() })).status).toBe(409);
    expect(
      Schema.decodeUnknownSync(LedgerEntry)(await (await post(ledgerPath, retry)).json())
        .reversalId,
    ).toBe(reversed.id);
    expect(
      Schema.decodeUnknownSync(LedgerList)(await (await get(ledgerPath + period)).json()).sources[0]
        ?.entryId,
    ).toBeNull();
    expect(
      (await post(ledgerPath, { ...request, requestId: randomUUID(), debitAccount: '606' })).status,
    ).toBe(409);
    const corrected = Schema.decodeUnknownSync(LedgerEntry)(
      await (
        await post(ledgerPath, {
          ...request,
          requestId: randomUUID(),
          debitAccount: '606',
          bookedOn: reverse.bookedOn,
        })
      ).json(),
    );
    expect(corrected.bookedOn).toBe(reverse.bookedOn);
    expect(() => sqlite.prepare('update bank_ledger_entries set label = ?').run('Changed')).toThrow(
      'ledger_immutable',
    );
    expect(() => sqlite.prepare('delete from bank_ledger_entries').run()).toThrow(
      'ledger_immutable',
    );
    const exported = await get(`${ledgerPath}/export${period}`);
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-disposition')).toContain('bank-ledger.csv');
    const csv = await exported.text();
    expect(csv).toContain('"12.34","0.00","EUR"');
    expect(csv).toContain('"0.00","12.34","EUR"');
    expect(csv).toContain('"\'=Literal, ""fee"""');
    expect(csv.trim().split('\r\n')).toHaveLength(7);
    const narrow = Schema.decodeUnknownSync(LedgerList)(
      await (await get(`${ledgerPath}?from=2026-09-06&to=2026-09-06`)).json(),
    );
    expect(narrow.entries.map((entry) => entry.id).sort()).toEqual(
      [reversed.id, corrected.id].sort(),
    );
    const augustPeriod = '?from=2026-08-01&to=2026-08-31';
    const august = Schema.decodeUnknownSync(LedgerList)(
      await (await get(ledgerPath + augustPeriod)).json(),
    );
    expect(august.entries.map((entry) => entry.id)).toEqual([entry.id]);
    expect(august.sources[0]).toMatchObject({ bookedOn: '2026-08-31', postingDate: '2026-09-06' });
    expect(
      (await (await get(`${ledgerPath}/export${augustPeriod}`)).text()).trim().split('\r\n'),
    ).toHaveLength(3);
    expect(
      narrow.entries.reduce(
        (net, entry) =>
          net + (entry.creditAccount === '512' ? entry.amountCents : -entry.amountCents),
        0,
      ),
    ).toBe(0);
    expect(
      (
        await post(`${ledgerPath}/${corrected.id}/reverse`, {
          requestId: randomUUID(),
          bookedOn: '2026-09-07',
          reason: 'Second correction',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(ledgerPath, {
          ...request,
          requestId: randomUUID(),
          bookedOn: '2026-09-06',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post(ledgerPath, {
          ...request,
          requestId: randomUUID(),
          bookedOn: '2026-09-07',
        })
      ).status,
    ).toBe(200);
    expect((await get(`${ledgerPath}?from=2026-09-06&to=2026-09-01`)).status).toBe(400);
    const tokenResponse = await post('/api/tokens', {
      name: 'Ledger denied',
      permissions: ['payment.read'],
      expiresAt: Date.now() + 86400000,
      rateLimitPerMinute: 60,
    });
    const token = Schema.decodeUnknownSync(ApiTokenCreated)(await tokenResponse.json());
    expect(
      (
        await fetch(`${server.baseUrl}${ledgerPath}${period}`, {
          headers: { authorization: `Bearer ${token.secret}` },
        })
      ).status,
    ).toBe(403);
    expect((await fetch(`${server.baseUrl}${ledgerPath}${period}`)).status).toBe(401);
    sqlite.prepare("delete from role_permissions where permission_code = 'ledger.post'").run();
    expect((await post(ledgerPath, request)).status).toBe(403);
    expect((await get(ledgerPath + period)).status).toBe(200);
    expect(sqlite.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([]);
    const insertSource = sqlite.prepare(
      `insert into bank_transactions (id, account, reference, booked_on, amount_cents, description, imported_at, imported_by_user_id) values (?, 'LIMIT', ?, '2026-08-01', -1, 'Limit test', ?, ?)`,
    );
    sqlite
      .transaction(() => {
        for (let index = 0; index < 10001; index++)
          insertSource.run(ulid(), String(index), entry.recordedAt, entry.recordedByUserId);
      })
      .immediate();
    expect((await get(`${ledgerPath}?from=2026-08-01&to=2026-08-01`)).status).toBe(409);
    expect((await get(`${ledgerPath}/export?from=2026-08-01&to=2026-08-01`)).status).toBe(409);
  } finally {
    sqlite.close();
    await server.close();
  }
}, 20000);

it('requires fee reversal before dissociation or receipt correction and rejects removed fee sources', async () => {
  const server = await startHttpTestServer();
  const post = (path: string, payload: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(payload),
    });
  const get = async (path: string) =>
    (await fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders })).json();
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
          dueDate: '2026-10-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    const path = `/api/invoices/${draft.id}`;
    expect((await post(`${path}/issue`, { expectedVersion: draft.version })).status).toBe(200);
    const invoice = Schema.decodeUnknownSync(InvoiceDetail)(await get(path));
    const paid = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post(`${path}/payments`, {
          requestId: randomUUID(),
          expectedVersion: invoice.version,
          amountCents: 10300,
          paidOn: '2026-09-01',
          method: 'transfer',
          reference: 'Gross',
        })
      ).json(),
    );
    expect(
      (
        await post('/api/banking/import', {
          account: 'FEES',
          format: 'csv',
          csvConfiguration: DefaultBankCsvConfiguration,
          content:
            'transaction_id,booked_on,amount,currency,description\nF,2026-09-01,100.00,EUR,Net',
        })
      ).status,
    ).toBe(200);
    const transaction = Schema.decodeUnknownSync(BankTransactionList)(
      await get('/api/banking/transactions'),
    )[0];
    const payment = paid.payments[0];
    if (!transaction || !payment) throw new Error('ledger.test.fixture_missing');
    const bankPath = `/api/banking/transactions/${transaction.id}`;
    const matched = Schema.decodeUnknownSync(BankTransactionList)(
      await (
        await post(`${bankPath}/match`, {
          requestId: randomUUID(),
          paymentId: payment.id,
          amountCents: 10300,
          feeCents: 300,
        })
      ).json(),
    );
    const match = matched[0]?.allocations[0];
    if (!match) throw new Error('ledger.test.match_missing');
    const request = {
      requestId: randomUUID(),
      sourceKind: 'fee',
      sourceId: match.matchId,
      bookedOn: '2026-09-01',
      debitAccount: '627',
      creditAccount: '511',
      label: 'Deducted fee',
    };
    const entry = Schema.decodeUnknownSync(LedgerEntry)(
      await (await post('/api/banking/ledger', request)).json(),
    );
    expect(entry.amountCents).toBe(300);
    expect(
      (await post(`${bankPath}/unmatch`, { matchId: match.matchId, reason: 'Wrong match' })).status,
    ).toBe(409);
    expect(
      (
        await post(`${path}/payments/${payment.id}/cancel`, {
          expectedVersion: paid.version,
          reason: 'Wrong receipt',
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post(`/api/banking/ledger/${entry.id}/reverse`, {
          requestId: randomUUID(),
          bookedOn: '2026-09-06',
          reason: 'Wrong match',
        })
      ).status,
    ).toBe(200);
    expect(
      (await post(`${bankPath}/unmatch`, { matchId: match.matchId, reason: 'Wrong match' })).status,
    ).toBe(200);
    expect(
      (await post('/api/banking/ledger', { ...request, requestId: randomUUID() })).status,
    ).toBe(409);
    expect((await post('/api/banking/ledger', request)).status).toBe(200);
    expect(
      (
        await post(`${path}/payments/${payment.id}/cancel`, {
          expectedVersion: paid.version,
          reason: 'Wrong receipt',
        })
      ).status,
    ).toBe(200);
    const ledger = Schema.decodeUnknownSync(LedgerList)(
      await get('/api/banking/ledger?from=2026-09-01&to=2026-09-06'),
    );
    expect(ledger.entries).toHaveLength(2);
    expect(ledger.sources).toHaveLength(0);
  } finally {
    await server.close();
  }
}, 20000);
