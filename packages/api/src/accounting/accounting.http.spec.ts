import {
  AccountingAccountList,
  AccountingBalanceReport,
  AccountingEntry,
  AccountingEvidence,
  AccountingFinancialReport,
  AccountingJournalList,
  AccountingLedgerReport,
  AccountingPeriod,
  AccountingTaxReport,
  OpeningBalancePreview,
} from '@froment/contracts';
import Sqlite from 'better-sqlite3';
import { Effect, Layer, Schema } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { startHttpTestServer } from '../server/server.spec-helper.js';
import { AuditLive } from '../audit/audit.js';
import { makeMigratedDatabaseLayer } from '../database/database.spec-helper.js';
import { defaultRuntimeConfig, RuntimeConfiguration } from '../runtime-config.js';
import { Accounting, AccountingLive } from './service.js';

it('reads the default accounting plan', async () => {
  const database = makeMigratedDatabaseLayer({
    filename: ':memory:',
    migrationsFolder: join(import.meta.dirname, '../../drizzle'),
  });
  const dependencies = Layer.mergeAll(
    database,
    AuditLive.pipe(Layer.provide(database)),
    Layer.succeed(RuntimeConfiguration, defaultRuntimeConfig),
    FetchHttpClient.layer,
  );
  const layer = Layer.merge(database, AccountingLive.pipe(Layer.provide(dependencies)));
  await Effect.runPromise(
    Effect.gen(function* () {
      const accounting = yield* Accounting;
      expect((yield* accounting.accounts).some(({ code }) => code === '411')).toBe(true);
      expect(
        (yield* accounting.balance({ startsOn: '2026-07-01', endsOn: '2027-06-30' })).rows,
      ).not.toHaveLength(0);
    }).pipe(Effect.provide(layer)),
  );
});

it('posts, reports, reverses, and protects accounting entries with evidence', async () => {
  const server = await startHttpTestServer();
  const get = (path: string) =>
    fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
  const post = (path: string, body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(body),
    });
  try {
    const currentAccount = await get('/api/auth/account');
    expect(currentAccount.status, await currentAccount.clone().text()).toBe(200);
    expect(await currentAccount.json()).toMatchObject({
      permissions: expect.arrayContaining(['accounting.read']),
    });
    const accountResponse = await get('/api/accounting/accounts');
    expect(
      accountResponse.status,
      `${await accountResponse.clone().text()}\n${server.output()}`,
    ).toBe(200);
    const accounts = Schema.decodeUnknownSync(AccountingAccountList)(await accountResponse.json());
    const journalResponse = await get('/api/accounting/journals');
    expect(journalResponse.status).toBe(200);
    const journals = Schema.decodeUnknownSync(AccountingJournalList)(await journalResponse.json());
    const receivable = accounts.find(({ code }) => code === '411');
    const income = accounts.find(({ code }) => code === '706');
    const journal = journals.find(({ kind }) => kind === 'general');
    if (receivable === undefined || income === undefined || journal === undefined) {
      throw new Error('accounting.test.defaults_missing');
    }
    const periodResponse = await post('/api/accounting/periods', {
      label: '2026-2027',
      startsOn: '2026-07-01',
      endsOn: '2027-06-30',
    });
    expect(periodResponse.status).toBe(200);
    const period = Schema.decodeUnknownSync(AccountingPeriod)(await periodResponse.json());
    const draftResponse = await post('/api/accounting/entries', {
      requestId: randomUUID(),
      journalId: journal.id,
      periodId: period.id,
      entryDate: '2026-09-12',
      reference: 'MANUAL-1',
      description: 'Manual entry',
      lines: [
        { accountId: receivable.id, label: 'Debit', debitCents: 12_000, creditCents: 0 },
        { accountId: income.id, label: 'Credit', debitCents: 0, creditCents: 12_000 },
      ],
    });
    expect(draftResponse.status, server.output()).toBe(200);
    const draft = Schema.decodeUnknownSync(AccountingEntry)(await draftResponse.json());
    const postedResponse = await post(`/api/accounting/entries/${draft.id}/post`, {
      requestId: randomUUID(),
      expectedVersion: draft.version,
    });
    expect(postedResponse.status, server.output()).toBe(200);
    const posted = Schema.decodeUnknownSync(AccountingEntry)(await postedResponse.json());
    expect(posted.status).toBe('posted');

    const query = '?startsOn=2026-07-01&endsOn=2027-06-30';
    const balanceResponse = await get(`/api/accounting/reports/balance${query}`);
    expect(balanceResponse.status, server.output()).toBe(200);
    const balance = Schema.decodeUnknownSync(AccountingBalanceReport)(await balanceResponse.json());
    expect(balance).toMatchObject({ debitCents: 12_000, creditCents: 12_000 });
    expect(
      Schema.decodeUnknownSync(AccountingLedgerReport)(
        await (await get(`/api/accounting/reports/ledger${query}`)).json(),
      ).rows,
    ).toHaveLength(2);
    expect(
      Schema.decodeUnknownSync(AccountingFinancialReport)(
        await (await get(`/api/accounting/reports/financial-statements${query}`)).json(),
      ).income.totalCents,
    ).toBe(12_000);
    expect(
      Schema.decodeUnknownSync(AccountingTaxReport)(
        await (await get(`/api/accounting/reports/france/vat${query}`)).json(),
      ).jurisdiction,
    ).toBe('FR');
    expect(await (await get(`/api/accounting/reports/fec${query}`)).text()).toContain('MANUAL-1');
    expect(
      JSON.parse(await (await get(`/api/accounting/reports/france/ca3${query}`)).text()),
    ).toMatchObject({ format: 'froment-ca3-v1', jurisdiction: 'FR' });

    const evidenceContent = Buffer.from('accounting evidence');
    const evidence = Schema.decodeUnknownSync(AccountingEvidence)(
      await (
        await post('/api/accounting/evidence', {
          entryId: posted.id,
          fileName: 'evidence.txt',
          mediaType: 'text/plain',
          contentBase64: evidenceContent.toString('base64'),
        })
      ).json(),
    );
    const evidenceResponse = await get(`/api/accounting/evidence/${evidence.id}/download`);
    expect(Buffer.from(await evidenceResponse.arrayBuffer())).toEqual(evidenceContent);

    const opening = Schema.decodeUnknownSync(OpeningBalancePreview)(
      await (
        await post('/api/accounting/opening-balances/preview', {
          csv: 'account,label,debit,credit\n411,Client,120.00,0\n706,Service,0,120.00',
          delimiter: ',',
          columns: {
            accountCode: 'account',
            accountLabel: 'label',
            debit: 'debit',
            credit: 'credit',
          },
          entryDate: '2026-09-12',
        })
      ).json(),
    );
    expect(opening).toMatchObject({ balanced: true, debitCents: 12_000, creditCents: 12_000 });

    const sqlite = new Sqlite(server.databaseFilename);
    try {
      expect(() =>
        sqlite
          .prepare('update accounting_entries set reference = ? where id = ?')
          .run('Changed', posted.id),
      ).toThrow('database.trigger.accounting_entries_posted_immutable');
      expect(() =>
        sqlite.prepare('delete from accounting_entry_lines where entry_id = ?').run(posted.id),
      ).toThrow('database.trigger.accounting_lines_posted_immutable_delete');
    } finally {
      sqlite.close();
    }
    const reversal = Schema.decodeUnknownSync(AccountingEntry)(
      await (
        await post(`/api/accounting/entries/${posted.id}/reverse`, {
          requestId: randomUUID(),
          expectedVersion: posted.version,
        })
      ).json(),
    );
    expect(reversal).toMatchObject({ status: 'posted', reversalOfEntryId: posted.id });
  } finally {
    await server.close();
  }
}, 20_000);
