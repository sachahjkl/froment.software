import {
  AccountingAccount,
  AccountingAccountList,
  AccountingBalanceReport,
  AccountingBalanceRow,
  AccountingConflict,
  AccountingEntry,
  AccountingEntryLine,
  AccountingEntryList,
  AccountingEvidence,
  AccountingEvidenceList,
  AccountingJournal,
  AccountingJournalList,
  AccountingLedgerReport,
  AccountingLedgerRow,
  AccountingLetterableLineList,
  AccountingLettering,
  AccountingTaxFilingSettings,
  AccountingTaxFilingSubmission,
  AccountingTaxFilingSubmissionList,
  AccountingPeriod,
  AccountingPeriodList,
  CurrencyCode,
  type AccountingAccountWrite,
  type AccountingEntryCommand,
  type AccountingEntryCreate,
  type AccountingEvidenceCreate,
  type AccountingJournalWrite,
  type AccountingLetteringCreate,
  type AccountingPeriodCreate,
  type AccountingReportQuery,
  type AccountingTaxFilingRequest,
  type AccountingTaxFilingSettingsUpdate,
  AccountingFinancialReport,
  type OpeningBalanceCommit,
  type OpeningBalanceRequest,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Option, Redacted, Schema } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';
import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { FranceAccountingJurisdiction } from './france.js';
import { RuntimeConfiguration } from '../runtime-config.js';

const encryptionAlgorithm = 'aes-256-gcm';
const encryptionKeyBytes = 32;
const encryptionIvBytes = 12;

const conflict = (code: AccountingConflict['code']) => new AccountingConflict({ code });
const periodTransitionAuditAction = (transition: 'open' | 'locked' | 'closed' | 'final') => {
  switch (transition) {
    case 'open':
      return 'accounting.period-reopened' as const;
    case 'locked':
      return 'accounting.period-locked' as const;
    case 'closed':
      return 'accounting.period-closed' as const;
    case 'final':
      return 'accounting.period-final-closed' as const;
  }
};
const SqlBoolean = Schema.Literals([0, 1]);
const AccountRow = Schema.Struct({
  ...AccountingAccount.fields,
  system: SqlBoolean,
  archived: SqlBoolean,
});
const JournalRow = Schema.Struct({ ...AccountingJournal.fields, archived: SqlBoolean });
const PeriodRow = Schema.Struct({ ...AccountingPeriod.fields, finalClosed: SqlBoolean });
const EntryRow = Schema.Struct({
  id: AccountingEntry.fields.id,
  requestId: AccountingEntry.fields.requestId,
  journalId: AccountingEntry.fields.journalId,
  periodId: AccountingEntry.fields.periodId,
  entryDate: AccountingEntry.fields.entryDate,
  reference: AccountingEntry.fields.reference,
  description: AccountingEntry.fields.description,
  currency: CurrencyCode,
  status: AccountingEntry.fields.status,
  reversalOfEntryId: AccountingEntry.fields.reversalOfEntryId,
  version: AccountingEntry.fields.version,
  createdAt: Schema.Int,
  postedAt: Schema.NullOr(Schema.Int),
});
const LineRow = Schema.Struct({ ...AccountingEntryLine.fields });
const FecRow = Schema.Struct({
  journalCode: Schema.String,
  journalLabel: Schema.String,
  entryId: Schema.String,
  entryDate: Schema.String,
  accountCode: Schema.String,
  accountLabel: Schema.String,
  lineLabel: Schema.String,
  debitCents: Schema.Int,
  creditCents: Schema.Int,
  reference: Schema.String,
  letteringCode: Schema.NullOr(Schema.String),
  letteringDate: Schema.NullOr(Schema.String),
  validationDate: Schema.String,
  currency: Schema.String,
});
const fecText = (value: string) =>
  value
    .replaceAll('|', ' ')
    .replaceAll(/[\r\n]/g, ' ')
    .trim();
const fecMoney = (cents: number) => {
  const absolute = Math.abs(cents);
  const value = `${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
  if (cents < 0) return `-${value}`;
  return value;
};
const sectionTotal = (
  kind: 'asset' | 'liability' | 'equity' | 'income' | 'expense',
  rows: ReadonlyArray<AccountingBalanceRow>,
  accountCodes: ReadonlySet<string>,
) => {
  const sectionRows = rows.filter((row) => accountCodes.has(row.accountCode));
  let sign = 1;
  if (kind === 'liability' || kind === 'equity' || kind === 'income') sign = -1;
  return {
    kind,
    rows: sectionRows,
    totalCents: sectionRows.reduce((sum, row) => sum + row.balanceCents * sign, 0),
  };
};

const parseCsvLine = (line: string, delimiter: string) => {
  const values: Array<string> = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';
    if (character === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values.map((item) => item.trim());
};
const parseMoney = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw conflict('accounting.csv_invalid');
  const [whole, decimal = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw conflict('accounting.csv_invalid');
  return cents;
};
const openingRows = (request: OpeningBalanceRequest) => {
  const lines = request.csv
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.trim() !== '');
  const headers = parseCsvLine(lines.shift() ?? '', request.delimiter);
  const index = (name: string) => {
    const result = headers.indexOf(name);
    if (result < 0) throw conflict('accounting.csv_invalid');
    return result;
  };
  const codeIndex = index(request.columns.accountCode);
  const labelIndex = index(request.columns.accountLabel);
  const debitIndex = index(request.columns.debit);
  const creditIndex = index(request.columns.credit);
  return lines.map((line) => {
    const cells = parseCsvLine(line, request.delimiter);
    const debitCents = parseMoney(cells[debitIndex] ?? '0');
    const creditCents = parseMoney(cells[creditIndex] ?? '0');
    return {
      accountCode: cells[codeIndex] ?? '',
      accountLabel: cells[labelIndex] ?? '',
      debitCents,
      creditCents,
      balanceCents: debitCents - creditCents,
    };
  });
};

const normalizeAccount = (account: typeof AccountRow.Type) => {
  return Schema.decodeUnknownSync(AccountingAccount)({
    ...account,
    system: account.system === 1,
    archived: account.archived === 1,
  });
};
const normalizeJournal = (journal: typeof JournalRow.Type) => {
  return Schema.decodeUnknownSync(AccountingJournal)({
    ...journal,
    archived: journal.archived === 1,
  });
};
const normalizePeriod = (period: typeof PeriodRow.Type) => {
  return Schema.decodeUnknownSync(AccountingPeriod)({
    ...period,
    finalClosed: period.finalClosed === 1,
  });
};

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const runtime = yield* RuntimeConfiguration;
  const httpClient = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
  const run = <A>(operation: string, body: () => A) =>
    Effect.try({
      try: body,
      catch: (cause) =>
        cause instanceof AccountingConflict ? cause : new DatabaseError({ operation, cause }),
    });
  const readAccount = (id: string) =>
    normalizeAccount(
      Schema.decodeUnknownSync(AccountRow)(
        sqlite
          .prepare(
            'select id, code, label, kind, system, archived, version from accounting_accounts where id = ?',
          )
          .get(id),
      ),
    );
  const readJournal = (id: string) =>
    normalizeJournal(
      Schema.decodeUnknownSync(JournalRow)(
        sqlite
          .prepare(
            'select id, code, label, kind, archived, version from accounting_journals where id = ?',
          )
          .get(id),
      ),
    );
  const readPeriod = (id: string) =>
    normalizePeriod(
      Schema.decodeUnknownSync(PeriodRow)(
        sqlite
          .prepare(
            'select id, label, starts_on as startsOn, ends_on as endsOn, status, final_closed as finalClosed, version from accounting_periods where id = ?',
          )
          .get(id),
      ),
    );
  const readEntry = (id: string) => {
    const entry = Schema.decodeUnknownSync(EntryRow)(
      sqlite
        .prepare(
          'select id, request_id as requestId, journal_id as journalId, period_id as periodId, entry_date as entryDate, reference, description, currency, status, reversal_of_entry_id as reversalOfEntryId, version, created_at as createdAt, posted_at as postedAt from accounting_entries where id = ?',
        )
        .get(id),
    );
    const lines = sqlite
      .prepare(
        'select id, position, account_id as accountId, label, debit_cents as debitCents, credit_cents as creditCents from accounting_entry_lines where entry_id = ? order by position',
      )
      .all(id)
      .map((row) => Schema.decodeUnknownSync(LineRow)(row));
    return Schema.decodeUnknownSync(AccountingEntry)({ ...entry, lines });
  };
  const accounts = run('accounting.accounts.list', () =>
    Schema.decodeUnknownSync(AccountingAccountList)(
      Schema.decodeUnknownSync(Schema.Array(AccountRow))(
        sqlite
          .prepare(
            'select id, code, label, kind, system, archived, version from accounting_accounts order by code',
          )
          .all(),
      ).map(normalizeAccount),
    ),
  );
  const writeAccount = Effect.fn('Accounting.writeAccount')(function* (
    id: string | undefined,
    request: AccountingAccountWrite,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.account.write', () =>
      sqlite
        .transaction(() => {
          const accountId = id ?? ulid(now);
          if (id === undefined)
            sqlite
              .prepare(
                'insert into accounting_accounts (id, code, label, kind, system, archived, version, created_at, updated_at) values (?, ?, ?, ?, 0, ?, 1, ?, ?)',
              )
              .run(
                accountId,
                request.code,
                request.label.trim(),
                request.kind,
                request.archived,
                now,
                now,
              );
          else {
            const current = readAccount(id);
            if (request.expectedVersion !== current.version)
              throw conflict('accounting.version_conflict');
            sqlite
              .prepare(
                'update accounting_accounts set code = ?, label = ?, kind = ?, archived = ?, version = version + 1, updated_at = ? where id = ?',
              )
              .run(request.code, request.label.trim(), request.kind, request.archived, now, id);
          }
          audit.insert({
            action: 'accounting.account-saved',
            actorUserId: actor,
            resourceType: 'accounting-account',
            resourceId: accountId,
            occurredAt: now,
          });
          return readAccount(accountId);
        })
        .immediate(),
    );
  });
  const journals = run('accounting.journals.list', () =>
    Schema.decodeUnknownSync(AccountingJournalList)(
      Schema.decodeUnknownSync(Schema.Array(JournalRow))(
        sqlite
          .prepare(
            'select id, code, label, kind, archived, version from accounting_journals order by code',
          )
          .all(),
      ).map(normalizeJournal),
    ),
  );
  const writeJournal = Effect.fn('Accounting.writeJournal')(function* (
    journalId: string | undefined,
    request: AccountingJournalWrite,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.journal.write', () => {
      const id = journalId ?? ulid(now);
      if (journalId === undefined) {
        sqlite
          .prepare(
            'insert into accounting_journals (id, code, label, kind, archived, version, created_at, updated_at) values (?, ?, ?, ?, ?, 1, ?, ?)',
          )
          .run(id, request.code, request.label.trim(), request.kind, request.archived, now, now);
      } else {
        const current = readJournal(id);
        if (request.expectedVersion !== current.version)
          throw conflict('accounting.version_conflict');
        sqlite
          .prepare(
            'update accounting_journals set code = ?, label = ?, kind = ?, archived = ?, version = version + 1, updated_at = ? where id = ?',
          )
          .run(request.code, request.label.trim(), request.kind, request.archived, now, id);
      }
      audit.insert({
        action: 'accounting.journal-saved',
        actorUserId: actor,
        resourceType: 'accounting-journal',
        resourceId: id,
        occurredAt: now,
      });
      return readJournal(id);
    });
  });
  const periods = run('accounting.periods.list', () =>
    Schema.decodeUnknownSync(AccountingPeriodList)(
      Schema.decodeUnknownSync(Schema.Array(PeriodRow))(
        sqlite
          .prepare(
            'select id, label, starts_on as startsOn, ends_on as endsOn, status, final_closed as finalClosed, version from accounting_periods order by starts_on desc',
          )
          .all(),
      ).map(normalizePeriod),
    ),
  );
  const createPeriod = Effect.fn('Accounting.createPeriod')(function* (
    request: AccountingPeriodCreate,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.period.create', () => {
      if (
        request.endsOn < request.startsOn ||
        sqlite
          .prepare('select 1 from accounting_periods where starts_on <= ? and ends_on >= ?')
          .get(request.endsOn, request.startsOn)
      )
        throw conflict('accounting.period_overlap');
      const id = ulid(now);
      sqlite
        .prepare(
          "insert into accounting_periods (id, label, starts_on, ends_on, status, final_closed, version, created_at, updated_at) values (?, ?, ?, ?, 'open', 0, 1, ?, ?)",
        )
        .run(id, request.label.trim(), request.startsOn, request.endsOn, now, now);
      audit.insert({
        action: 'accounting.period-created',
        actorUserId: actor,
        resourceType: 'accounting-period',
        resourceId: id,
        occurredAt: now,
      });
      return readPeriod(id);
    });
  });
  const transitionPeriod = Effect.fn('Accounting.transitionPeriod')(function* (
    id: string,
    expectedVersion: number,
    transition: 'open' | 'locked' | 'closed' | 'final',
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.period.transition', () => {
      const current = readPeriod(id);
      if (current.version !== expectedVersion) throw conflict('accounting.version_conflict');
      if (current.finalClosed && transition === 'open')
        throw conflict('accounting.period_final_closed');
      const allowed =
        (current.status === 'open' && transition === 'locked') ||
        (current.status === 'locked' && (transition === 'open' || transition === 'closed')) ||
        (current.status === 'closed' && (transition === 'open' || transition === 'final'));
      if (!allowed) throw conflict('accounting.period_transition_invalid');
      if (
        transition !== 'open' &&
        sqlite
          .prepare("select 1 from accounting_entries where period_id = ? and status = 'draft'")
          .get(id) !== undefined
      )
        throw conflict('accounting.period_has_drafts');
      const status = transition === 'final' ? 'closed' : transition;
      const finalClosed = transition === 'final' ? 1 : Number(current.finalClosed);
      sqlite
        .prepare(
          'update accounting_periods set status = ?, final_closed = ?, version = version + 1, updated_at = ? where id = ?',
        )
        .run(status, finalClosed, now, id);
      audit.insert({
        action: periodTransitionAuditAction(transition),
        actorUserId: actor,
        resourceType: 'accounting-period',
        resourceId: id,
        occurredAt: now,
      });
      return readPeriod(id);
    });
  });
  const entries = run('accounting.entries.list', () =>
    Schema.decodeUnknownSync(AccountingEntryList)(
      sqlite
        .prepare('select id from accounting_entries order by entry_date desc, created_at desc')
        .all()
        .map((row) =>
          readEntry(Schema.decodeUnknownSync(Schema.Struct({ id: Schema.String }))(row).id),
        ),
    ),
  );
  const createEntryData = (
    request: AccountingEntryCreate,
    actor: UlidValue,
    now: number,
    status: 'draft' | 'posted' = 'draft',
    reversalOfEntryId: string | null = null,
  ) =>
    sqlite
      .transaction(() => {
        const prior = Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String))(
          sqlite
            .prepare('select id from accounting_entries where request_id = ?')
            .pluck()
            .get(request.requestId),
        );
        if (prior !== undefined) return readEntry(prior);
        const period = readPeriod(request.periodId);
        if (
          period.status !== 'open' ||
          request.entryDate < period.startsOn ||
          request.entryDate > period.endsOn
        )
          throw conflict('accounting.period_not_open');
        const debit = request.lines.reduce((sum, line) => sum + line.debitCents, 0);
        const credit = request.lines.reduce((sum, line) => sum + line.creditCents, 0);
        if (debit !== credit || debit === 0) throw conflict('accounting.entry_unbalanced');
        const currency = Schema.decodeUnknownSync(CurrencyCode)(
          sqlite
            .prepare('select functional_currency from company_settings where id = 1')
            .pluck()
            .get(),
        );
        const id = ulid(now);
        sqlite
          .prepare(
            "insert into accounting_entries (id, request_id, journal_id, period_id, entry_date, reference, description, currency, status, reversal_of_entry_id, version, created_at, created_by_user_id, posted_at, posted_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?, null, null)",
          )
          .run(
            id,
            request.requestId,
            request.journalId,
            request.periodId,
            request.entryDate,
            request.reference.trim(),
            request.description.trim(),
            currency,
            reversalOfEntryId,
            now,
            actor,
          );
        const insert = sqlite.prepare(
          'insert into accounting_entry_lines (id, entry_id, position, account_id, label, debit_cents, credit_cents) values (?, ?, ?, ?, ?, ?, ?)',
        );
        request.lines.forEach((line, position) =>
          insert.run(
            ulid(now),
            id,
            position,
            line.accountId,
            line.label.trim(),
            line.debitCents,
            line.creditCents,
          ),
        );
        if (status === 'posted') {
          sqlite
            .prepare(
              "update accounting_entries set status = 'posted', posted_at = ?, posted_by_user_id = ? where id = ?",
            )
            .run(now, actor, id);
          sqlite
            .prepare('update company_settings set accounting_initialized = 1 where id = 1')
            .run();
        }
        audit.insert({
          action: status === 'posted' ? 'accounting.entry-posted' : 'accounting.entry-created',
          actorUserId: actor,
          resourceType: 'accounting-entry',
          resourceId: id,
          occurredAt: now,
        });
        return readEntry(id);
      })
      .immediate();
  const createEntry = Effect.fn('Accounting.createEntry')(function* (
    request: AccountingEntryCreate,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.entry.create', () => createEntryData(request, actor, now));
  });
  const postEntry = Effect.fn('Accounting.postEntry')(function* (
    id: string,
    command: AccountingEntryCommand,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.entry.post', () => {
      const current = readEntry(id);
      if (current.version !== command.expectedVersion)
        throw conflict('accounting.version_conflict');
      if (current.status !== 'draft') throw conflict('accounting.entry_not_draft');
      const period = readPeriod(current.periodId);
      if (period.status !== 'open') throw conflict('accounting.period_not_open');
      sqlite
        .prepare(
          "update accounting_entries set status = 'posted', version = version + 1, posted_at = ?, posted_by_user_id = ? where id = ?",
        )
        .run(now, actor, id);
      sqlite.prepare('update company_settings set accounting_initialized = 1 where id = 1').run();
      audit.insert({
        action: 'accounting.entry-posted',
        actorUserId: actor,
        resourceType: 'accounting-entry',
        resourceId: id,
        occurredAt: now,
      });
      return readEntry(id);
    });
  });
  const reverseEntry = Effect.fn('Accounting.reverseEntry')(function* (
    id: string,
    command: AccountingEntryCommand,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.entry.reverse', () =>
      sqlite
        .transaction(() => {
          const current = readEntry(id);
          if (current.version !== command.expectedVersion)
            throw conflict('accounting.version_conflict');
          if (current.status !== 'posted') throw conflict('accounting.entry_not_posted');
          const reversal = createEntryData(
            {
              requestId: command.requestId,
              journalId: current.journalId,
              periodId: current.periodId,
              entryDate: current.entryDate,
              reference: `EXT-${current.reference}`,
              description: `Extourne — ${current.description}`,
              lines: current.lines.map((line) => ({
                accountId: line.accountId,
                label: line.label,
                debitCents: line.creditCents,
                creditCents: line.debitCents,
              })),
            },
            actor,
            now,
            'posted',
            id,
          );
          sqlite
            .prepare(
              "update accounting_entries set status = 'reversed', version = version + 1 where id = ?",
            )
            .run(id);
          audit.insert({
            action: 'accounting.entry-reversed',
            actorUserId: actor,
            resourceType: 'accounting-entry',
            resourceId: id,
            occurredAt: now,
          });
          return readEntry(reversal.id);
        })
        .immediate(),
    );
  });
  const balance = (query: AccountingReportQuery) =>
    run('accounting.report.balance', () => {
      const rows = Schema.decodeUnknownSync(Schema.Array(AccountingBalanceRow))(
        sqlite
          .prepare(
            "select a.code as accountCode, a.label as accountLabel, coalesce(sum(case when e.id is not null then l.debit_cents else 0 end),0) as debitCents, coalesce(sum(case when e.id is not null then l.credit_cents else 0 end),0) as creditCents, coalesce(sum(case when e.id is not null then l.debit_cents-l.credit_cents else 0 end),0) as balanceCents from accounting_accounts a left join accounting_entry_lines l on l.account_id = a.id left join accounting_entries e on e.id = l.entry_id and e.status in ('posted','reversed') and e.entry_date between ? and ? group by a.id order by a.code",
          )
          .all(query.startsOn, query.endsOn),
      );
      const debitCents = rows.reduce((sum, row) => sum + row.debitCents, 0);
      const creditCents = rows.reduce((sum, row) => sum + row.creditCents, 0);
      return Schema.decodeUnknownSync(AccountingBalanceReport)({
        ...query,
        rows,
        debitCents,
        creditCents,
      });
    });
  const ledger = (query: AccountingReportQuery) =>
    run('accounting.report.ledger', () =>
      AccountingLedgerReport.make({
        ...query,
        rows: Schema.decodeUnknownSync(Schema.Array(AccountingLedgerRow))(
          sqlite
            .prepare(
              "select e.id entryId, e.entry_date entryDate, j.code journalCode, e.reference, e.description, a.code accountCode, a.label accountLabel, l.label lineLabel, l.debit_cents debitCents, l.credit_cents creditCents from accounting_entries e join accounting_journals j on j.id=e.journal_id join accounting_entry_lines l on l.entry_id=e.id join accounting_accounts a on a.id=l.account_id where e.status in ('posted','reversed') and e.entry_date between ? and ? order by e.entry_date,e.id,l.position",
            )
            .all(query.startsOn, query.endsOn),
        ),
      }),
    );
  const financial = (query: AccountingReportQuery) =>
    Effect.map(balance(query), (report) => {
      const accountKinds = Schema.decodeUnknownSync(
        Schema.Array(Schema.Struct({ code: Schema.String, kind: AccountingAccount.fields.kind })),
      )(sqlite.prepare('select code, kind from accounting_accounts').all());
      const codes = (kind: AccountingAccount['kind']) =>
        new Set(
          accountKinds.filter((account) => account.kind === kind).map((account) => account.code),
        );
      const assets = sectionTotal('asset', report.rows, codes('asset'));
      const liabilities = sectionTotal('liability', report.rows, codes('liability'));
      const equity = sectionTotal('equity', report.rows, codes('equity'));
      const income = sectionTotal('income', report.rows, codes('income'));
      const expenses = sectionTotal('expense', report.rows, codes('expense'));
      return AccountingFinancialReport.make({
        ...query,
        assets,
        liabilities,
        equity,
        income,
        expenses,
        netIncomeCents: income.totalCents - expenses.totalCents,
      });
    });
  const tax = (query: AccountingReportQuery) =>
    Effect.map(balance(query), (report) =>
      FranceAccountingJurisdiction.taxReport(query.startsOn, query.endsOn, report.rows),
    );
  const ca3 = (query: AccountingReportQuery) =>
    Effect.map(tax(query), FranceAccountingJurisdiction.taxExport);
  const fec = (query: AccountingReportQuery) =>
    run('accounting.report.fec', () =>
      [
        'JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise',
        ...sqlite
          .prepare(
            "select j.code journalCode, j.label journalLabel, e.id entryId, replace(e.entry_date,'-','') entryDate, a.code accountCode, a.label accountLabel, l.label lineLabel, l.debit_cents debitCents, l.credit_cents creditCents, e.reference, g.code letteringCode, case when g.created_at is null then null else strftime('%Y%m%d', g.created_at / 1000, 'unixepoch') end letteringDate, strftime('%Y%m%d', e.posted_at / 1000, 'unixepoch') validationDate, e.currency from accounting_entries e join accounting_journals j on j.id=e.journal_id join accounting_entry_lines l on l.entry_id=e.id join accounting_accounts a on a.id=l.account_id left join accounting_lettering_lines gl on gl.line_id=l.id left join accounting_lettering g on g.id=gl.lettering_id where e.status in ('posted','reversed') and e.entry_date between ? and ? order by e.entry_date,e.id,l.position",
          )
          .all(query.startsOn, query.endsOn)
          .map((raw) => {
            const row = Schema.decodeUnknownSync(FecRow)(raw);
            return [
              row.journalCode,
              row.journalLabel,
              row.entryId,
              row.entryDate,
              row.accountCode,
              row.accountLabel,
              '',
              '',
              row.reference,
              row.entryDate,
              row.lineLabel,
              fecMoney(row.debitCents),
              fecMoney(row.creditCents),
              row.letteringCode ?? '',
              row.letteringDate ?? '',
              row.validationDate,
              '',
              row.currency,
            ]
              .map(fecText)
              .join('|');
          }),
      ].join('\r\n'),
    );
  const openingPreview = (request: OpeningBalanceRequest) =>
    run('accounting.opening.preview', () => {
      const rows = openingRows(request);
      const debitCents = rows.reduce((sum, row) => sum + row.debitCents, 0);
      const creditCents = rows.reduce((sum, row) => sum + row.creditCents, 0);
      return {
        rows,
        debitCents,
        creditCents,
        balanced: debitCents === creditCents && debitCents > 0,
      };
    });
  const openingCommit = Effect.fn('Accounting.openingCommit')(function* (
    request: OpeningBalanceCommit,
    actor: UlidValue,
  ) {
    const rows = openingRows(request);
    const preview = {
      debitCents: rows.reduce((sum, row) => sum + row.debitCents, 0),
      creditCents: rows.reduce((sum, row) => sum + row.creditCents, 0),
    };
    if (preview.debitCents !== preview.creditCents || preview.debitCents === 0)
      return yield* conflict('accounting.opening_unbalanced');
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.opening.commit', () => {
      const account = sqlite.prepare('select id, code from accounting_accounts where code = ?');
      return createEntryData(
        {
          requestId: request.requestId,
          journalId: request.journalId,
          periodId: request.periodId,
          entryDate: request.entryDate,
          reference: 'BALANCE-OUVERTURE',
          description: 'opening-balance',
          lines: rows.map((row) => {
            const found = Schema.decodeUnknownSync(
              Schema.Struct({ id: Schema.String, code: Schema.String }),
            )(account.get(row.accountCode));
            return {
              accountId: found.id,
              label: row.accountLabel,
              debitCents: row.debitCents,
              creditCents: row.creditCents,
            };
          }),
        },
        actor,
        now,
        'posted',
      );
    });
  });
  const letterableLines = run('accounting.lettering.lines', () =>
    Schema.decodeUnknownSync(AccountingLetterableLineList)(
      sqlite
        .prepare(
          `select l.id as lineId, e.id as entryId, e.entry_date as entryDate, e.reference,
             a.id as accountId, a.code as accountCode, a.label as accountLabel, l.label as lineLabel,
             l.debit_cents as debitCents, l.credit_cents as creditCents, g.code as letteringCode
           from accounting_entry_lines l
           join accounting_entries e on e.id = l.entry_id
           join accounting_accounts a on a.id = l.account_id
           left join accounting_lettering_lines gl on gl.line_id = l.id
           left join accounting_lettering g on g.id = gl.lettering_id
           where e.status in ('posted', 'reversed')
           order by a.code, e.entry_date, e.id, l.position`,
        )
        .all(),
    ),
  );
  const createLettering = Effect.fn('Accounting.createLettering')(function* (
    request: AccountingLetteringCreate,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.lettering.create', () =>
      sqlite
        .transaction(() => {
          const prior = Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String))(
            sqlite
              .prepare('select id from accounting_lettering where request_id = ?')
              .pluck()
              .get(request.requestId),
          );
          if (prior !== undefined) {
            const lineIds = Schema.decodeUnknownSync(Schema.Array(Schema.String))(
              sqlite
                .prepare(
                  'select line_id from accounting_lettering_lines where lettering_id = ? order by line_id',
                )
                .pluck()
                .all(prior),
            );
            const requested = [...request.lineIds].sort();
            if (lineIds.join('|') !== requested.join('|'))
              throw conflict('accounting.lettering_conflict');
            return Schema.decodeUnknownSync(AccountingLettering)({
              ...Schema.decodeUnknownSync(
                Schema.Struct({
                  id: Schema.String,
                  code: Schema.String,
                  accountId: Schema.String,
                  createdAt: Schema.Int,
                }),
              )(
                sqlite
                  .prepare(
                    'select id, code, account_id as accountId, created_at as createdAt from accounting_lettering where id = ?',
                  )
                  .get(prior),
              ),
              lineIds,
            });
          }
          const placeholders = request.lineIds.map(() => '?').join(',');
          const lines = Schema.decodeUnknownSync(
            Schema.Array(
              Schema.Struct({
                id: Schema.String,
                accountId: Schema.String,
                debitCents: Schema.Int,
                creditCents: Schema.Int,
                lettered: Schema.Boolean,
              }),
            ),
          )(
            sqlite
              .prepare(
                `select l.id, l.account_id as accountId, l.debit_cents as debitCents,
                   l.credit_cents as creditCents, gl.line_id is not null as lettered
                 from accounting_entry_lines l
                 join accounting_entries e on e.id = l.entry_id
                 left join accounting_lettering_lines gl on gl.line_id = l.id
                 where e.status in ('posted', 'reversed') and l.id in (${placeholders})`,
              )
              .all(...request.lineIds),
          );
          if (lines.length !== request.lineIds.length)
            throw conflict('accounting.lettering_invalid');
          const accountId = lines[0]?.accountId;
          if (accountId === undefined) throw conflict('accounting.lettering_invalid');
          if (lines.some((line) => line.accountId !== accountId || line.lettered))
            throw conflict('accounting.lettering_invalid');
          const debitCents = lines.reduce((total, line) => total + line.debitCents, 0);
          const creditCents = lines.reduce((total, line) => total + line.creditCents, 0);
          if (debitCents === 0 || debitCents !== creditCents)
            throw conflict('accounting.lettering_invalid');
          const id = ulid(now);
          const code = `LET-${id.slice(-10)}`;
          sqlite
            .prepare(
              'insert into accounting_lettering (id, request_id, code, account_id, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?)',
            )
            .run(id, request.requestId, code, accountId, now, actor);
          const insertLine = sqlite.prepare(
            'insert into accounting_lettering_lines (lettering_id, line_id) values (?, ?)',
          );
          for (const lineId of request.lineIds) insertLine.run(id, lineId);
          audit.insert({
            action: 'accounting.lettered',
            actorUserId: actor,
            resourceType: 'accounting-lettering',
            resourceId: id,
            metadata: { code, lineCount: String(request.lineIds.length) },
            occurredAt: now,
          });
          return AccountingLettering.make({
            id,
            code,
            accountId,
            lineIds: request.lineIds,
            createdAt: now,
          });
        })
        .immediate(),
    );
  });
  const evidence = run('accounting.evidence.list', () =>
    Schema.decodeUnknownSync(AccountingEvidenceList)(
      sqlite
        .prepare(
          'select id, entry_id as entryId, file_name as fileName, media_type as mediaType, size, sha256, created_at as createdAt from accounting_evidence order by created_at desc',
        )
        .all(),
    ),
  );
  const createEvidence = Effect.fn('Accounting.createEvidence')(function* (
    request: AccountingEvidenceCreate,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.evidence.create', () => {
      readEntry(request.entryId);
      const content = Buffer.from(request.contentBase64, 'base64');
      const sha256 = createHash('sha256').update(content).digest('hex');
      const id = ulid(now);
      sqlite
        .prepare(
          'insert into accounting_evidence (id, entry_id, file_name, media_type, size, sha256, content, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          id,
          request.entryId,
          request.fileName.trim(),
          request.mediaType,
          content.length,
          sha256,
          content,
          now,
          actor,
        );
      audit.insert({
        action: 'accounting.evidence-added',
        actorUserId: actor,
        resourceType: 'accounting-evidence',
        resourceId: id,
        occurredAt: now,
      });
      return Schema.decodeUnknownSync(AccountingEvidence)(
        sqlite
          .prepare(
            'select id, entry_id as entryId, file_name as fileName, media_type as mediaType, size, sha256, created_at as createdAt from accounting_evidence where id=?',
          )
          .get(id),
      );
    });
  });
  const downloadEvidence = Effect.fn('Accounting.downloadEvidence')(function* (
    id: UlidValue,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.evidence.download', () => {
      const result = Schema.decodeUnknownSync(
        Schema.Struct({
          fileName: AccountingEvidence.fields.fileName,
          mediaType: AccountingEvidence.fields.mediaType,
          content: Schema.Uint8Array,
        }),
      )(
        sqlite
          .prepare(
            'select file_name as fileName, media_type as mediaType, content from accounting_evidence where id = ?',
          )
          .get(id),
      );
      audit.insert({
        action: 'accounting.evidence-accessed',
        actorUserId: actor,
        resourceType: 'accounting-evidence',
        resourceId: id,
        occurredAt: now,
      });
      return result;
    });
  });
  const TaxFilingSettingsRow = Schema.Struct({
    adapter: AccountingTaxFilingSettings.fields.adapter,
    endpoint: Schema.NullOr(Schema.String),
    encryptedApiKey: Schema.NullOr(Schema.String),
    encryptionIv: Schema.NullOr(Schema.String),
    encryptionTag: Schema.NullOr(Schema.String),
    updatedAt: Schema.NullOr(Schema.Int),
  });
  const taxFilingSettingsRow = () =>
    Schema.decodeUnknownSync(TaxFilingSettingsRow)(
      sqlite
        .prepare(
          'select adapter, endpoint, encrypted_api_key as encryptedApiKey, encryption_iv as encryptionIv, encryption_tag as encryptionTag, updated_at as updatedAt from accounting_tax_filing_settings where id = 1',
        )
        .get(),
    );
  const encryptionKey = () => {
    const configured = Option.getOrUndefined(runtime.secrets.settingsEncryptionKey);
    if (configured === undefined) throw conflict('accounting.encryption_unavailable');
    const key = Buffer.from(Redacted.value(configured), 'base64');
    if (key.length !== encryptionKeyBytes) throw conflict('accounting.encryption_unavailable');
    return key;
  };
  const encryptSecret = (secret: string) => {
    const iv = randomBytes(encryptionIvBytes);
    const cipher = createCipheriv(encryptionAlgorithm, encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      encryptedApiKey: encrypted.toString('base64'),
      encryptionIv: iv.toString('base64'),
      encryptionTag: cipher.getAuthTag().toString('base64'),
    };
  };
  const decryptSecret = (row: typeof TaxFilingSettingsRow.Type) => {
    if (row.encryptedApiKey === null || row.encryptionIv === null || row.encryptionTag === null)
      return Option.getOrUndefined(runtime.taxFiling.apiKey);
    const decipher = createDecipheriv(
      encryptionAlgorithm,
      encryptionKey(),
      Buffer.from(row.encryptionIv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(row.encryptionTag, 'base64'));
    return Redacted.make(
      Buffer.concat([
        decipher.update(Buffer.from(row.encryptedApiKey, 'base64')),
        decipher.final(),
      ]).toString('utf8'),
    );
  };
  const taxFilingSettings = run('accounting.tax-filing.settings', () => {
    const row = taxFilingSettingsRow();
    return AccountingTaxFilingSettings.make({
      adapter: row.adapter,
      endpoint: row.endpoint,
      credentialsPresent: row.encryptedApiKey !== null || Option.isSome(runtime.taxFiling.apiKey),
      updatedAt: row.updatedAt,
    });
  });
  const updateTaxFilingSettings = Effect.fn('Accounting.updateTaxFilingSettings')(function* (
    request: AccountingTaxFilingSettingsUpdate,
    actor: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.tax-filing.settings-update', () => {
      const current = taxFilingSettingsRow();
      if (request.adapter === 'http' && request.endpoint === null)
        throw conflict('accounting.tax_filing_configuration_invalid');
      let encrypted = {
        encryptedApiKey: current.encryptedApiKey,
        encryptionIv: current.encryptionIv,
        encryptionTag: current.encryptionTag,
      };
      if (request.apiKey !== null) encrypted = encryptSecret(request.apiKey);
      if (request.adapter === 'local')
        encrypted = { encryptedApiKey: null, encryptionIv: null, encryptionTag: null };
      sqlite
        .prepare(
          'update accounting_tax_filing_settings set adapter = ?, endpoint = ?, encrypted_api_key = ?, encryption_iv = ?, encryption_tag = ?, updated_at = ? where id = 1',
        )
        .run(
          request.adapter,
          request.adapter === 'http' ? request.endpoint : null,
          encrypted.encryptedApiKey,
          encrypted.encryptionIv,
          encrypted.encryptionTag,
          now,
        );
      audit.insert({
        action: 'accounting.tax-filing-settings-updated',
        actorUserId: actor,
        resourceType: 'accounting-tax-filing-settings',
        resourceId: '1',
        metadata: { adapter: request.adapter },
        occurredAt: now,
      });
      const saved = taxFilingSettingsRow();
      return AccountingTaxFilingSettings.make({
        adapter: saved.adapter,
        endpoint: saved.endpoint,
        credentialsPresent:
          saved.encryptedApiKey !== null || Option.isSome(runtime.taxFiling.apiKey),
        updatedAt: saved.updatedAt,
      });
    });
  });
  const taxFilings = run('accounting.tax-filing.list', () =>
    Schema.decodeUnknownSync(AccountingTaxFilingSubmissionList)(
      sqlite
        .prepare(
          'select id, request_id as requestId, adapter, starts_on as startsOn, ends_on as endsOn, payload_sha256 as payloadSha256, provider_receipt as providerReceipt, submitted_at as submittedAt from accounting_tax_filings order by submitted_at desc',
        )
        .all(),
    ),
  );
  const submitTaxFiling = Effect.fn('Accounting.submitTaxFiling')(function* (
    request: AccountingTaxFilingRequest,
    actor: UlidValue,
  ) {
    const report = yield* tax(request);
    const payload = FranceAccountingJurisdiction.taxExport(report);
    const payloadSha256 = createHash('sha256').update(payload).digest('hex');
    const prior = sqlite
      .prepare(
        'select id, request_id as requestId, adapter, starts_on as startsOn, ends_on as endsOn, payload_sha256 as payloadSha256, provider_receipt as providerReceipt, submitted_at as submittedAt from accounting_tax_filings where request_id = ?',
      )
      .get(request.requestId);
    if (prior !== undefined) {
      const saved = Schema.decodeUnknownSync(AccountingTaxFilingSubmission)(prior);
      if (
        saved.startsOn !== request.startsOn ||
        saved.endsOn !== request.endsOn ||
        saved.payloadSha256 !== payloadSha256
      )
        return yield* conflict('accounting.tax_filing_failed');
      return saved;
    }
    const settings = taxFilingSettingsRow();
    let providerReceipt = `SIM-${payloadSha256.slice(0, 24)}`;
    if (settings.adapter === 'http') {
      const endpoint = settings.endpoint;
      if (endpoint === null) return yield* conflict('accounting.tax_filing_configuration_invalid');
      const credential = decryptSecret(settings);
      if (credential === undefined)
        return yield* conflict('accounting.tax_filing_configuration_invalid');
      const response = yield* httpClient
        .execute(
          HttpClientRequest.post(endpoint).pipe(
            HttpClientRequest.acceptJson,
            HttpClientRequest.bearerToken(Redacted.value(credential)),
            HttpClientRequest.bodyText(payload, 'application/json'),
          ),
        )
        .pipe(
          Effect.timeout(runtime.taxFiling.requestTimeoutMillis),
          Effect.mapError(() => conflict('accounting.tax_filing_failed')),
        );
      const decoded = yield* HttpClientResponse.schemaBodyJson(
        Schema.Struct({ receipt: AccountingTaxFilingSubmission.fields.providerReceipt }),
      )(response).pipe(Effect.mapError(() => conflict('accounting.tax_filing_failed')));
      providerReceipt = decoded.receipt;
    }
    const now = yield* Clock.currentTimeMillis;
    return yield* run('accounting.tax-filing.submit', () => {
      const id = ulid(now);
      sqlite
        .prepare(
          'insert into accounting_tax_filings (id, request_id, adapter, starts_on, ends_on, payload_sha256, provider_receipt, submitted_at, submitted_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          id,
          request.requestId,
          settings.adapter,
          request.startsOn,
          request.endsOn,
          payloadSha256,
          providerReceipt,
          now,
          actor,
        );
      audit.insert({
        action: 'accounting.tax-filed',
        actorUserId: actor,
        resourceType: 'accounting-tax-filing',
        resourceId: id,
        metadata: { adapter: settings.adapter, payloadSha256 },
        occurredAt: now,
      });
      return AccountingTaxFilingSubmission.make({
        id,
        requestId: request.requestId,
        adapter: settings.adapter,
        startsOn: request.startsOn,
        endsOn: request.endsOn,
        payloadSha256,
        providerReceipt,
        submittedAt: now,
      });
    });
  });
  return {
    accounts,
    writeAccount,
    journals,
    writeJournal,
    periods,
    createPeriod,
    transitionPeriod,
    entries,
    createEntry,
    postEntry,
    reverseEntry,
    balance,
    ledger,
    financial,
    tax,
    ca3,
    fec,
    openingPreview,
    openingCommit,
    letterableLines,
    createLettering,
    evidence,
    createEvidence,
    downloadEvidence,
    taxFilingSettings,
    updateTaxFilingSettings,
    taxFilings,
    submitTaxFiling,
  };
});

export class Accounting extends Context.Service<Accounting, Effect.Success<typeof make>>()(
  '@froment/api/Accounting',
) {}
export const AccountingLive = Layer.effect(Accounting, make);
