import {
  LedgerConflict,
  LedgerEntry,
  LedgerJournalEntry,
  LedgerList,
  LedgerPeriod,
  LedgerRequest,
  LedgerReverse,
  LedgerSource,
  LedgerSourceDetail,
  LedgerSourceKind,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';
import { Audit } from '../audit/audit.js';
import { BusinessConfig } from '../business/business-config.js';
import { Database, DatabaseError } from '../database/database.js';
import { invoiceIssueDate } from '../invoices/invoices.js';

const entryQuery = `select e.id, e.request_id as requestId, e.source_kind as sourceKind, e.source_id as sourceId,
  e.debit_account as debitAccount, e.credit_account as creditAccount, e.label, e.amount_cents as amountCents,
  e.booked_on as bookedOn, e.recorded_at as recordedAt, e.recorded_by_user_id as recordedByUserId,
  e.reverses_id as reversesId, (select id from bank_ledger_entries where reverses_id = e.id) as reversalId,
  case when e.source_kind = 'debit' then (select t.reference from bank_transactions t where t.id = e.source_id)
    else (select t.reference from bank_matches m join bank_transactions t on t.id = m.transaction_id where m.id = e.source_id)
    end as sourceReference
  from bank_ledger_entries e`;
const sourceQuery = `select s.*, max(s.bookedOn, coalesce((select max(r.booked_on)
  from bank_ledger_entries r where r.source_kind = s.sourceKind and r.source_id = s.sourceId
  and r.reverses_id is not null), s.bookedOn)) as postingDate,
  (select e.id from bank_ledger_entries e where e.source_kind = s.sourceKind
  and e.source_id = s.sourceId and e.reverses_id is null
  and not exists (select 1 from bank_ledger_entries r where r.reverses_id = e.id)) as entryId from (
  select id as sourceId, 'debit' as sourceKind, reference, account, booked_on as bookedOn, -amount_cents as amountCents
  from bank_transactions where amount_cents < 0
  union all
  select m.id as sourceId, 'fee' as sourceKind, t.reference, t.account, t.booked_on as bookedOn, m.fee_cents as amountCents
  from bank_matches m join bank_transactions t on t.id = m.transaction_id
  join invoice_payments p on p.id = m.payment_id
  where m.fee_cents > 0 and m.cancelled_at is null and p.cancelled_at is null
  ) s`;

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const business = yield* BusinessConfig;
  const conflict = () => new LedgerConflict({ code: 'ledger.conflict' });
  const readEntry = (id: string) => {
    const row = sqlite.prepare(`${entryQuery} where e.id = ?`).get(id);
    if (row === undefined) throw conflict();
    return Schema.decodeUnknownSync(LedgerEntry)(row);
  };
  const readPeriod = (period: typeof LedgerPeriod.Type) => {
    if (!Schema.is(LedgerPeriod)(period)) throw conflict();
    const entries = Schema.decodeUnknownSync(Schema.Array(LedgerJournalEntry))(
      sqlite
        .prepare(
          `${entryQuery} where e.booked_on between ? and ? order by e.booked_on, e.recorded_at, e.id limit 10001`,
        )
        .all(period.from, period.to),
    );
    const sources = Schema.decodeUnknownSync(Schema.Array(LedgerSource))(
      sqlite
        .prepare(
          `${sourceQuery} where s.bookedOn between ? and ? order by s.bookedOn, s.sourceId limit 10001`,
        )
        .all(period.from, period.to),
    );
    if (entries.length > 10000 || sources.length > 10000) throw conflict();
    return LedgerList.make({ entries, sources });
  };
  const list = Effect.fn('BankLedger.list')((period: typeof LedgerPeriod.Type) =>
    Effect.try({
      try: () => sqlite.transaction(() => readPeriod(period)).deferred(),
      catch: (cause) =>
        cause instanceof LedgerConflict
          ? cause
          : new DatabaseError({ operation: 'ledger.list', cause }),
    }),
  );
  const getEntry = Effect.fn('BankLedger.getEntry')((id: string) =>
    Effect.try({
      try: () => readEntry(id),
      catch: (cause) =>
        cause instanceof LedgerConflict
          ? cause
          : new DatabaseError({ operation: 'ledger.getEntry', cause }),
    }),
  );
  const getSource = Effect.fn('BankLedger.getSource')(
    (kind: typeof LedgerSourceKind.Type, id: string) =>
      Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const row = sqlite
                .prepare(`${sourceQuery} where s.sourceKind = ? and s.sourceId = ?`)
                .get(kind, id);
              if (row === undefined) throw conflict();
              const source = Schema.decodeUnknownSync(LedgerSource)(row);
              const transactionId =
                kind === 'debit'
                  ? id
                  : sqlite
                      .prepare('select transaction_id from bank_matches where id = ?')
                      .pluck()
                      .get(id);
              return Schema.decodeUnknownSync(LedgerSourceDetail)({ source, transactionId });
            })
            .deferred(),
        catch: (cause) =>
          cause instanceof LedgerConflict
            ? cause
            : new DatabaseError({ operation: 'ledger.getSource', cause }),
      }),
  );
  const insert = (entry: typeof LedgerEntry.Type) => {
    sqlite
      .prepare(`insert into bank_ledger_entries (id, request_id, source_kind, source_id, debit_account, credit_account,
      label, amount_cents, booked_on, recorded_at, recorded_by_user_id, reverses_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        entry.id,
        entry.requestId,
        entry.sourceKind,
        entry.sourceId,
        entry.debitAccount,
        entry.creditAccount,
        entry.label,
        entry.amountCents,
        entry.bookedOn,
        entry.recordedAt,
        entry.recordedByUserId,
        entry.reversesId,
      );
  };
  const post = Effect.fn('BankLedger.post')(function* (
    request: typeof LedgerRequest.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!Schema.is(LedgerRequest)(request)) throw conflict();
            const previous = sqlite
              .prepare(`${entryQuery} where e.request_id = ?`)
              .get(request.requestId);
            if (previous !== undefined) {
              const saved = Schema.decodeUnknownSync(LedgerEntry)(previous);
              if (
                saved.reversesId !== null ||
                saved.sourceKind !== request.sourceKind ||
                saved.sourceId !== request.sourceId ||
                saved.bookedOn !== request.bookedOn ||
                saved.debitAccount !== request.debitAccount ||
                saved.creditAccount !== request.creditAccount ||
                saved.label !== request.label.trim() ||
                saved.recordedByUserId !== actor
              )
                throw conflict();
              return saved;
            }
            const row = sqlite
              .prepare(`${sourceQuery} where s.sourceKind = ? and s.sourceId = ?`)
              .get(request.sourceKind, request.sourceId);
            if (row === undefined) throw conflict();
            const source = Schema.decodeUnknownSync(LedgerSource)(row);
            if (
              source.entryId !== null ||
              request.bookedOn !== source.postingDate ||
              source.postingDate > invoiceIssueDate(now, business.timeZone)
            )
              throw conflict();
            const entry = LedgerEntry.make({
              ...request,
              label: request.label.trim(),
              id: ulid(),
              amountCents: source.amountCents,
              bookedOn: source.postingDate,
              recordedAt: DateTime.formatIso(DateTime.makeUnsafe(now)),
              recordedByUserId: actor,
              reversesId: null,
              reversalId: null,
            });
            insert(entry);
            audit.insert({
              action: 'bank.ledger-posted',
              actorUserId: actor,
              resourceType: 'bank-ledger',
              resourceId: entry.id,
              occurredAt: now,
              metadata: {
                sourceId: source.sourceId,
                sourceKind: source.sourceKind,
                amountCents: String(source.amountCents),
              },
            });
            return entry;
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof LedgerConflict
          ? cause
          : new DatabaseError({ operation: 'ledger.post', cause }),
    });
  });
  const reverse = Effect.fn('BankLedger.reverse')(function* (
    id: string,
    request: typeof LedgerReverse.Type,
    actor: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        sqlite
          .transaction(() => {
            if (!Schema.is(LedgerReverse)(request)) throw conflict();
            const previous = sqlite
              .prepare(`${entryQuery} where e.request_id = ?`)
              .get(request.requestId);
            if (previous !== undefined) {
              const saved = Schema.decodeUnknownSync(LedgerEntry)(previous);
              if (
                saved.reversesId !== id ||
                saved.label !== request.reason.trim() ||
                saved.bookedOn !== request.bookedOn ||
                saved.recordedByUserId !== actor
              )
                throw conflict();
              return saved;
            }
            const original = readEntry(id);
            if (
              original.reversesId !== null ||
              original.reversalId !== null ||
              request.bookedOn < original.bookedOn ||
              request.bookedOn > invoiceIssueDate(now, business.timeZone)
            )
              throw conflict();
            const entry = LedgerEntry.make({
              ...original,
              id: ulid(),
              requestId: request.requestId,
              label: request.reason.trim(),
              debitAccount: original.creditAccount,
              creditAccount: original.debitAccount,
              bookedOn: request.bookedOn,
              recordedAt: DateTime.formatIso(DateTime.makeUnsafe(now)),
              recordedByUserId: actor,
              reversesId: original.id,
              reversalId: null,
            });
            insert(entry);
            audit.insert({
              action: 'bank.ledger-reversed',
              actorUserId: actor,
              resourceType: 'bank-ledger',
              resourceId: entry.id,
              occurredAt: now,
              metadata: { reversesId: original.id, reason: request.reason.trim() },
            });
            return entry;
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof LedgerConflict
          ? cause
          : new DatabaseError({ operation: 'ledger.reverse', cause }),
    });
  });
  return { list, getEntry, getSource, post, reverse };
});

export class BankLedger extends Context.Service<BankLedger, Effect.Success<typeof make>>()(
  '@froment/api/BankLedger',
) {}
export const BankLedgerLive = Layer.effect(BankLedger, make);
