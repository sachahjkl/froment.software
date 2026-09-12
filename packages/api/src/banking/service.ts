import {
  BankImportInvalid,
  BankMatchConflict,
  BankMatchHistory,
  BankTransaction,
  BankAllocation,
  BankMatchRequest,
  BankPaymentList,
  BankTransactionNotFound,
  BankMatchSuggestionList,
  BankSuggestionLimit,
  CalendarDate,
  Ulid,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { Schema } from 'effect';
import { parseBankStatement } from './statement.js';

const makeBanking = Effect.gen(function* () {
  const database = yield* Database;
  const audit = yield* Audit;
  const payments = Effect.fn('Banking.payments')((invoiceId: string) =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(BankPaymentList)(
          database.sqlite
            .prepare(`select p.id, p.paid_on as paidOn, p.reference, p.amount_cents as amountCents,
      p.amount_cents - coalesce((select sum(amount_cents) from bank_matches where payment_id = p.id and cancelled_at is null), 0) as availableCents
      from invoice_payments p where p.invoice_id = ? and p.cancelled_at is null order by p.paid_on, p.id`)
            .all(invoiceId),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.bank.payments', cause }),
    }),
  );
  const history = Effect.fn('Banking.history')(function* (transactionId: string) {
    const exists = yield* Effect.try({
      try: () =>
        database.sqlite
          .prepare('select 1 from bank_transactions where id = ?')
          .get(transactionId) !== undefined,
      catch: (cause) => new DatabaseError({ operation: 'get.bank.transaction', cause }),
    });
    if (!exists) return yield* new BankTransactionNotFound({ code: 'bank.transaction_not_found' });
    return yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(BankMatchHistory)(
          database.sqlite
            .prepare(`
        select m.id, m.amount_cents as amountCents, m.fee_cents as feeCents, m.payment_id as paymentId, p.invoice_id as invoiceId,
          i.invoice_number as invoiceNumber, m.matched_at as matchedAt,
          m.matched_by_user_id as matchedByUserId, m.cancelled_at as cancelledAt,
          m.cancelled_by_user_id as cancelledByUserId, m.cancellation_reason as cancellationReason
        from bank_matches m join invoice_payments p on p.id = m.payment_id
        join invoices i on i.id = p.invoice_id
        where m.transaction_id = ? order by m.matched_at desc, m.id desc limit 100
      `)
            .all(transactionId),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.bank.match.history', cause }),
    });
  });
  const listTransactions = Effect.fn('Banking.listTransactions')((transactionId: string | null) =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(
          Schema.Array(
            Schema.Struct({
              ...BankTransaction.fields,
              allocations: Schema.fromJsonString(
                Schema.Array(
                  Schema.Struct({
                    ...BankAllocation.fields,
                    paymentCancelled: Schema.Literals([0, 1]),
                  }),
                ),
              ),
            }),
          ),
        )(
          database.sqlite
            .prepare(
              `select t.id, t.account, t.reference, t.booked_on as bookedOn, t.amount_cents as amountCents, t.description, t.imported_at as importedAt,
             coalesce((select sum(amount_cents - fee_cents) from bank_matches where transaction_id = t.id and cancelled_at is null), 0) as matchedCents,
             (select json_group_array(json_object('matchId', m.id, 'amountCents', m.amount_cents, 'feeCents', m.fee_cents, 'paymentId', m.payment_id, 'invoiceId', p.invoice_id, 'invoiceNumber', i.invoice_number, 'paymentCancelled', case when p.cancelled_at is not null then 1 else 0 end))
              from bank_matches m join invoice_payments p on p.id = m.payment_id join invoices i on i.id = p.invoice_id where m.transaction_id = t.id and m.cancelled_at is null) as allocations
              from bank_transactions t where (? is null or t.id = ?) order by t.booked_on desc, t.id desc limit 1000`,
            )
            .all(transactionId, transactionId),
        ).map((row) => ({
          ...row,
          allocations: row.allocations.map((allocation) => ({
            ...allocation,
            paymentCancelled: allocation.paymentCancelled === 1,
          })),
        })),
      catch: (cause) => new DatabaseError({ operation: 'list.bank.transactions', cause }),
    }),
  );
  const list = listTransactions(null);
  const get = Effect.fn('Banking.get')(function* (transactionId: string) {
    const transaction = (yield* listTransactions(transactionId))[0];
    if (transaction === undefined)
      return yield* new BankTransactionNotFound({ code: 'bank.transaction_not_found' });
    return transaction;
  });
  const suggestions = Effect.fn('Banking.suggestions')(function* (transactionId: string) {
    const transaction = yield* get(transactionId);
    if (transaction.amountCents <= transaction.matchedCents || transaction.amountCents <= 0)
      return BankMatchSuggestionList.make([]);
    return yield* Effect.try({
      try: () => {
        const candidates = Schema.decodeUnknownSync(
          Schema.Array(
            Schema.Struct({
              paymentId: Ulid,
              invoiceId: Ulid,
              invoiceNumber: Schema.NullOr(Schema.String),
              clientDisplayName: Schema.String,
              paidOn: CalendarDate,
              paymentReference: Schema.String,
              availableCents: Schema.Int,
            }),
          ),
        )(
          database.sqlite
            .prepare(
              `select p.id as paymentId, p.invoice_id as invoiceId,
                i.invoice_number as invoiceNumber, r.client_display_name as clientDisplayName,
                p.paid_on as paidOn, p.reference as paymentReference,
                p.amount_cents - coalesce((select sum(amount_cents) from bank_matches
                  where payment_id = p.id and cancelled_at is null), 0) as availableCents
               from invoice_payments p
               join invoices i on i.id = p.invoice_id
               join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
               where p.cancelled_at is null
               order by p.paid_on desc, p.id limit 1000`,
            )
            .all(),
        );
        const text = `${transaction.reference} ${transaction.description}`
          .normalize('NFKD')
          .replace(/\p{Mark}/gu, '')
          .toLocaleLowerCase('fr');
        const available = transaction.amountCents - transaction.matchedCents;
        return BankMatchSuggestionList.make(
          candidates
            .flatMap((candidate) => {
              if (candidate.availableCents <= 0) return [];
              const amountCents = Math.min(candidate.availableCents, available);
              let score = 0;
              const reasons: Array<
                | 'exact-amount'
                | 'close-amount'
                | 'invoice-reference'
                | 'payment-reference'
                | 'close-date'
              > = [];
              if (candidate.availableCents === available) {
                score += 55;
                reasons.push('exact-amount');
              } else if (
                Math.abs(candidate.availableCents - available) <=
                Math.max(100, Math.round(available / 100))
              ) {
                score += 35;
                reasons.push('close-amount');
              }
              if (candidate.invoiceNumber && text.includes(candidate.invoiceNumber.toLowerCase())) {
                score += 25;
                reasons.push('invoice-reference');
              }
              const paymentReference = candidate.paymentReference.trim().toLocaleLowerCase('fr');
              if (paymentReference.length >= 4 && text.includes(paymentReference)) {
                score += 10;
                reasons.push('payment-reference');
              }
              const days = Math.abs(
                (Date.parse(candidate.paidOn) - Date.parse(transaction.bookedOn)) / 86_400_000,
              );
              if (days <= 7) {
                score += days <= 3 ? 10 : 5;
                reasons.push('close-date');
              }
              return score < 35
                ? []
                : [{ ...candidate, amountCents, score: Math.min(score, 100), reasons }];
            })
            .toSorted(
              (left, right) =>
                right.score - left.score || left.paymentId.localeCompare(right.paymentId),
            )
            .slice(0, BankSuggestionLimit),
        );
      },
      catch: (cause) => new DatabaseError({ operation: 'bank.suggestions', cause }),
    });
  });
  const classifyStatement = (request: BankImportRequestValue) => {
    const rows = parseBankStatement(request).map((row) => {
      const existing = database.sqlite
        .prepare(
          'select booked_on as bookedOn, amount_cents as amountCents, description from bank_transactions where account = ? and reference = ?',
        )
        .get(request.account.trim(), row.reference);
      if (existing !== undefined) {
        const stored = Schema.decodeUnknownSync(
          Schema.Struct({
            bookedOn: Schema.String,
            amountCents: Schema.Number,
            description: Schema.String,
          }),
        )(existing);
        if (
          stored.bookedOn !== row.bookedOn ||
          stored.amountCents !== row.amountCents ||
          stored.description !== row.description
        )
          throw new BankImportInvalid({ code: 'bank.import_invalid' });
      }
      return { ...row, existing: existing !== undefined };
    });
    const existing = rows.filter((row) => row.existing).length;
    return { rows, added: rows.length - existing, existing };
  };
  const previewStatement = Effect.fn('Banking.previewStatement')(
    (request: BankImportRequestValue) =>
      Effect.try({
        try: () => database.sqlite.transaction(() => classifyStatement(request)).deferred(),
        catch: (cause) =>
          cause instanceof BankImportInvalid
            ? cause
            : new DatabaseError({ operation: 'preview.bank.statement', cause }),
      }),
  );
  const importStatement = Effect.fn('Banking.importStatement')(function* (
    request: BankImportRequestValue,
    actorUserId: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            const { rows, added, existing } = classifyStatement(request);
            for (const row of rows) {
              if (row.existing) continue;
              database.sqlite
                .prepare(
                  'insert into bank_transactions (id, account, reference, booked_on, amount_cents, description, imported_at, imported_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  ulid(now),
                  request.account.trim(),
                  row.reference,
                  row.bookedOn,
                  row.amountCents,
                  row.description,
                  DateTime.formatIso(DateTime.makeUnsafe(now)),
                  actorUserId,
                );
            }
            if (added > 0)
              audit.insert({
                action: 'bank.imported',
                actorUserId,
                resourceType: 'bank-account',
                resourceId: request.account.trim(),
                metadata: { added: String(added) },
                occurredAt: now,
              });
            return { added, existing };
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof BankImportInvalid
          ? cause
          : new DatabaseError({ operation: 'import.bank.statement', cause }),
    });
  });
  const match = Effect.fn('Banking.match')(function* (
    transactionId: string,
    request: typeof BankMatchRequest.Type,
    actorUserId: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    const { paymentId, amountCents, feeCents, requestId } = request;
    yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            const row = database.sqlite
              .prepare('select amount_cents as amountCents from bank_transactions where id = ?')
              .get(transactionId);
            if (row === undefined)
              throw new BankTransactionNotFound({ code: 'bank.transaction_not_found' });
            const transaction = Schema.decodeUnknownSync(
              Schema.Struct({ amountCents: Schema.Number }),
            )(row);
            const existing = database.sqlite
              .prepare(
                'select transaction_id as transactionId, payment_id as paymentId, amount_cents as amountCents, fee_cents as feeCents from bank_matches where request_id = ?',
              )
              .get(requestId);
            if (existing !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({
                  transactionId: Schema.String,
                  paymentId: Schema.String,
                  amountCents: Schema.Number,
                  feeCents: Schema.Number,
                }),
              )(existing);
              if (
                saved.transactionId === transactionId &&
                saved.paymentId === paymentId &&
                saved.amountCents === amountCents &&
                saved.feeCents === feeCents
              )
                return;
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            }
            const payment = database.sqlite
              .prepare(
                'select amount_cents as amountCents from invoice_payments where id = ? and cancelled_at is null',
              )
              .get(paymentId);
            const allocatedToTransaction = Schema.decodeUnknownSync(Schema.Number)(
              database.sqlite
                .prepare(
                  'select coalesce(sum(amount_cents - fee_cents), 0) from bank_matches where transaction_id = ? and cancelled_at is null',
                )
                .pluck()
                .get(transactionId),
            );
            const allocatedToPayment = Schema.decodeUnknownSync(Schema.Number)(
              database.sqlite
                .prepare(
                  'select coalesce(sum(amount_cents), 0) from bank_matches where payment_id = ? and cancelled_at is null',
                )
                .pluck()
                .get(paymentId),
            );
            if (
              payment === undefined ||
              transaction.amountCents <= 0 ||
              !Schema.is(BankMatchRequest)(request) ||
              amountCents - feeCents > transaction.amountCents - allocatedToTransaction ||
              Schema.decodeUnknownSync(Schema.Struct({ amountCents: Schema.Number }))(payment)
                .amountCents -
                allocatedToPayment <
                amountCents ||
              Schema.decodeUnknownSync(Schema.Int)(
                database.sqlite
                  .prepare(
                    'select count(*) from bank_matches where transaction_id = ? and cancelled_at is null',
                  )
                  .pluck()
                  .get(transactionId),
              ) >= 100
            )
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            database.sqlite
              .prepare(
                'insert into bank_matches (id, transaction_id, payment_id, amount_cents, fee_cents, request_id, matched_at, matched_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                ulid(now),
                transactionId,
                paymentId,
                amountCents,
                feeCents,
                requestId,
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
              );
            audit.insert({
              action: 'bank.matched',
              actorUserId,
              resourceType: 'bank-transaction',
              resourceId: transactionId,
              metadata: {
                paymentId,
                amountCents: String(amountCents),
                feeCents: String(feeCents),
                requestId,
              },
              occurredAt: now,
            });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof BankTransactionNotFound || cause instanceof BankMatchConflict
          ? cause
          : new DatabaseError({ operation: 'match.bank.transaction', cause }),
    });
    return yield* list;
  });
  const unmatch = Effect.fn('Banking.unmatch')(function* (
    transactionId: string,
    matchId: string,
    reason: string,
    actorUserId: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            if (
              database.sqlite
                .prepare('select 1 from bank_transactions where id = ?')
                .get(transactionId) === undefined
            )
              throw new BankTransactionNotFound({ code: 'bank.transaction_not_found' });
            const postedFee = database.sqlite
              .prepare(`select 1 from bank_ledger_entries e where e.source_kind = 'fee' and e.source_id = ?
                and e.reverses_id is null and not exists (select 1 from bank_ledger_entries r where r.reverses_id = e.id)`)
              .get(matchId);
            if (postedFee !== undefined)
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            const cancelled = database.sqlite
              .prepare(
                'update bank_matches set cancelled_at = ?, cancelled_by_user_id = ?, cancellation_reason = ? where transaction_id = ? and id = ? and cancelled_at is null',
              )
              .run(
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
                reason.trim(),
                transactionId,
                matchId,
              ).changes;
            if (cancelled === 0) {
              const previous = database.sqlite
                .prepare(
                  'select cancellation_reason as reason from bank_matches where transaction_id = ? and id = ? and cancelled_at is not null',
                )
                .get(transactionId, matchId);
              if (
                previous === undefined ||
                Schema.decodeUnknownSync(Schema.Struct({ reason: Schema.String }))(previous)
                  .reason !== reason.trim()
              )
                throw new BankMatchConflict({ code: 'bank.match_conflict' });
            }
            if (cancelled > 0)
              audit.insert({
                action: 'bank.unmatched',
                actorUserId,
                resourceType: 'bank-transaction',
                resourceId: transactionId,
                metadata: { reason: reason.trim() },
                occurredAt: now,
              });
          })
          .immediate(),
      catch: (cause) =>
        cause instanceof BankTransactionNotFound || cause instanceof BankMatchConflict
          ? cause
          : new DatabaseError({ operation: 'unmatch.bank.transaction', cause }),
    });
    return yield* list;
  });
  return {
    list,
    get,
    history,
    payments,
    suggestions,
    previewStatement,
    importStatement,
    match,
    unmatch,
  };
});
export class Banking extends Context.Service<Banking, Effect.Success<typeof makeBanking>>()(
  '@froment/api/Banking',
) {}
export const BankingLive = Layer.effect(Banking, makeBanking);
