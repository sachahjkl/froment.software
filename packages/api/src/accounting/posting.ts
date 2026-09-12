import type Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { DateTime, Schema } from 'effect';

interface PostingLine {
  readonly accountCode: string;
  readonly label: string;
  readonly debitCents: number;
  readonly creditCents: number;
}
interface PostingInput {
  readonly sqlite: Sqlite.Database;
  readonly requestId?: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
  readonly journalKind: 'sales' | 'purchases' | 'bank' | 'general';
  readonly entryDate: string;
  readonly reference: string;
  readonly description: string;
  readonly currency: string;
  readonly actorUserId: string;
  readonly now: number;
  readonly lines: ReadonlyArray<PostingLine>;
}

export class AccountingPostingUnavailable extends Error {}

export const postAccountingEntry = (input: PostingInput): string | undefined => {
  const initialized = input.sqlite
    .prepare('select accounting_initialized from company_settings where id = 1')
    .pluck()
    .get();
  if (initialized !== 1) return undefined;
  const optionalString = Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String));
  const periodId = optionalString(
    input.sqlite
      .prepare(
        "select id from accounting_periods where status = 'open' and starts_on <= ? and ends_on >= ? limit 1",
      )
      .pluck()
      .get(input.entryDate, input.entryDate),
  );
  const journalId = optionalString(
    input.sqlite
      .prepare(
        'select id from accounting_journals where kind = ? and archived = 0 order by code limit 1',
      )
      .pluck()
      .get(input.journalKind),
  );
  if (periodId === undefined || journalId === undefined) {
    throw new AccountingPostingUnavailable('accounting.posting_unavailable');
  }
  const accountId = (code: string) => {
    const id = optionalString(
      input.sqlite
        .prepare('select id from accounting_accounts where code = ? and archived = 0')
        .pluck()
        .get(code),
    );
    if (id === undefined) throw new AccountingPostingUnavailable('accounting.account_missing');
    return id;
  };
  const debitCents = input.lines.reduce((total, line) => total + line.debitCents, 0);
  const creditCents = input.lines.reduce((total, line) => total + line.creditCents, 0);
  if (debitCents !== creditCents || debitCents === 0) {
    throw new AccountingPostingUnavailable('accounting.posting_unbalanced');
  }
  const id = ulid(input.now);
  input.sqlite
    .prepare(
      "insert into accounting_entries (id, request_id, journal_id, period_id, entry_date, reference, description, currency, status, source_type, source_id, version, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, 1, ?, ?)",
    )
    .run(
      id,
      input.requestId ?? randomUUID(),
      journalId,
      periodId,
      input.entryDate,
      input.reference,
      input.description,
      input.currency,
      input.sourceType ?? null,
      input.sourceId ?? null,
      input.now,
      input.actorUserId,
    );
  const insertLine = input.sqlite.prepare(
    'insert into accounting_entry_lines (id, entry_id, position, account_id, label, debit_cents, credit_cents) values (?, ?, ?, ?, ?, ?, ?)',
  );
  input.lines.forEach((line, position) =>
    insertLine.run(
      ulid(input.now),
      id,
      position,
      accountId(line.accountCode),
      line.label,
      line.debitCents,
      line.creditCents,
    ),
  );
  input.sqlite
    .prepare(
      "update accounting_entries set status = 'posted', posted_at = ?, posted_by_user_id = ? where id = ?",
    )
    .run(input.now, input.actorUserId, id);
  return id;
};

export const reverseAccountingEntry = (
  sqlite: Sqlite.Database,
  originalRequestId: string,
  actorUserId: string,
  now: number,
): string | undefined => {
  const original = Schema.decodeUnknownSync(
    Schema.UndefinedOr(
      Schema.Struct({
        id: Schema.String,
        journalId: Schema.String,
        currency: Schema.String,
        reference: Schema.String,
      }),
    ),
  )(
    sqlite
      .prepare(
        "select id, journal_id as journalId, currency, reference from accounting_entries where request_id = ? and status = 'posted'",
      )
      .get(originalRequestId),
  );
  if (original === undefined) return undefined;
  const entryDate = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(now));
  const periodId = Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String))(
    sqlite
      .prepare(
        "select id from accounting_periods where status = 'open' and starts_on <= ? and ends_on >= ? limit 1",
      )
      .pluck()
      .get(entryDate, entryDate),
  );
  if (periodId === undefined)
    throw new AccountingPostingUnavailable('accounting.reversal_period_unavailable');
  const reversalId = ulid(now);
  sqlite
    .prepare(
      "insert into accounting_entries (id, request_id, journal_id, period_id, entry_date, reference, description, currency, status, reversal_of_entry_id, version, created_at, created_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, 1, ?, ?)",
    )
    .run(
      reversalId,
      randomUUID(),
      original.journalId,
      periodId,
      entryDate,
      `EXT-${original.reference}`,
      'accounting-reversal',
      original.currency,
      original.id,
      now,
      actorUserId,
    );
  const lines = Schema.decodeUnknownSync(
    Schema.Array(
      Schema.Struct({
        accountId: Schema.String,
        label: Schema.String,
        debitCents: Schema.Int,
        creditCents: Schema.Int,
      }),
    ),
  )(
    sqlite
      .prepare(
        'select account_id as accountId, label, debit_cents as debitCents, credit_cents as creditCents from accounting_entry_lines where entry_id = ? order by position',
      )
      .all(original.id),
  );
  const insertLine = sqlite.prepare(
    'insert into accounting_entry_lines (id, entry_id, position, account_id, label, debit_cents, credit_cents) values (?, ?, ?, ?, ?, ?, ?)',
  );
  lines.forEach((line, position) =>
    insertLine.run(
      ulid(now),
      reversalId,
      position,
      line.accountId,
      line.label,
      line.creditCents,
      line.debitCents,
    ),
  );
  sqlite
    .prepare(
      "update accounting_entries set status = 'posted', posted_at = ?, posted_by_user_id = ? where id = ?",
    )
    .run(now, actorUserId, reversalId);
  sqlite
    .prepare(
      "update accounting_entries set status = 'reversed', version = version + 1 where id = ?",
    )
    .run(original.id);
  return reversalId;
};

export const reverseAccountingSource = (
  sqlite: Sqlite.Database,
  sourceType: string,
  sourceId: string,
  actorUserId: string,
  now: number,
) => {
  const requestId = Schema.decodeUnknownSync(Schema.UndefinedOr(Schema.String))(
    sqlite
      .prepare(
        "select request_id from accounting_entries where source_type = ? and source_id = ? and status = 'posted'",
      )
      .pluck()
      .get(sourceType, sourceId),
  );
  if (requestId === undefined) return undefined;
  return reverseAccountingEntry(sqlite, requestId, actorUserId, now);
};
