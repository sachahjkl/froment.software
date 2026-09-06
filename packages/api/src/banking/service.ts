import {
  BankImportInvalid,
  BankMatchConflict,
  BankMatchHistory,
  BankTransaction,
  BankTransactionNotFound,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { Schema } from 'effect';
import { parseBankStatement } from './csv.js';

const makeBanking = Effect.gen(function* () {
  const database = yield* Database;
  const audit = yield* Audit;
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
        select m.id, m.payment_id as paymentId, p.invoice_id as invoiceId,
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
  const list = Effect.try({
    try: () =>
      Schema.decodeUnknownSync(
        Schema.Array(
          Schema.Struct({ ...BankTransaction.fields, paymentCancelled: Schema.Literals([0, 1]) }),
        ),
      )(
        database.sqlite
          .prepare(
            `select t.id, t.account, t.reference, t.booked_on as bookedOn, t.amount_cents as amountCents, t.description, t.imported_at as importedAt, m.id as matchId, m.payment_id as paymentId, p.invoice_id as invoiceId, i.invoice_number as invoiceNumber, case when p.cancelled_at is not null then 1 else 0 end as paymentCancelled from bank_transactions t left join bank_matches m on m.transaction_id = t.id and m.cancelled_at is null left join invoice_payments p on p.id = m.payment_id left join invoices i on i.id = p.invoice_id order by t.booked_on desc, t.id desc limit 1000`,
          )
          .all(),
      ).map((row) => ({ ...row, paymentCancelled: row.paymentCancelled === 1 })),
    catch: (cause) => new DatabaseError({ operation: 'list.bank.transactions', cause }),
  });
  const importStatement = Effect.fn('Banking.importStatement')(function* (
    request: BankImportRequestValue,
    actorUserId: string,
  ) {
    const rows = yield* Effect.try({
      try: () => parseBankStatement(request.csv),
      catch: () => new BankImportInvalid({ code: 'bank.import_invalid' }),
    });
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            let added = 0;
            for (const row of rows) {
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
                continue;
              }
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
              added++;
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
            return { added, existing: rows.length - added };
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
    paymentId: string,
    actorUserId: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
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
                'select payment_id as paymentId from bank_matches where transaction_id = ? and cancelled_at is null',
              )
              .get(transactionId);
            if (existing !== undefined) {
              if (
                Schema.decodeUnknownSync(Schema.Struct({ paymentId: Schema.String }))(existing)
                  .paymentId === paymentId
              )
                return;
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            }
            const payment = database.sqlite
              .prepare(
                'select amount_cents as amountCents from invoice_payments where id = ? and cancelled_at is null',
              )
              .get(paymentId);
            if (
              payment === undefined ||
              transaction.amountCents <= 0 ||
              Schema.decodeUnknownSync(Schema.Struct({ amountCents: Schema.Number }))(payment)
                .amountCents !== transaction.amountCents ||
              database.sqlite
                .prepare('select 1 from bank_matches where payment_id = ? and cancelled_at is null')
                .get(paymentId) !== undefined
            )
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            database.sqlite
              .prepare(
                'insert into bank_matches (id, transaction_id, payment_id, matched_at, matched_by_user_id) values (?, ?, ?, ?, ?)',
              )
              .run(
                ulid(now),
                transactionId,
                paymentId,
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
              );
            audit.insert({
              action: 'bank.matched',
              actorUserId,
              resourceType: 'bank-transaction',
              resourceId: transactionId,
              metadata: { paymentId },
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
            const changed = database.sqlite
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
            if (changed === 0) {
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
            if (changed > 0)
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
  return { list, history, importStatement, match, unmatch };
});
export class Banking extends Context.Service<Banking, Effect.Success<typeof makeBanking>>()(
  '@froment/api/Banking',
) {}
export const BankingLive = Layer.effect(Banking, makeBanking);
