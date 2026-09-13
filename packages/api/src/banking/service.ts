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
  SupplierBankMatchList,
  SupplierBankPaymentList,
  type SupplierBankMatchRequest,
  CalendarDate,
  CurrencyCode,
  Ulid,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer } from 'effect';
import type Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { Database, DatabaseError } from '../database/database.js';
import { Audit } from '../audit/audit.js';
import { Schema } from 'effect';
import { parseBankStatement } from './statement.js';
import {
  convertToFunctionalCents,
  findCurrencyConversion,
} from '../company/currency-conversion.js';
import { AccountingPostingUnavailable, postAccountingEntry } from '../accounting/posting.js';

const proportionalCents = (totalCents: number, partCents: number, wholeCents: number) => {
  const numerator = BigInt(totalCents) * BigInt(partCents);
  const divisor = BigInt(wholeCents);
  return Number((numerator + divisor / 2n) / divisor);
};
interface CustomerSettlementInput {
  readonly sqlite: Sqlite.Database;
  readonly requestId: string;
  readonly actorUserId: string;
  readonly now: number;
  readonly bookedOn: string;
  readonly reference: string;
  readonly bankFunctionalCents: number;
  readonly feeFunctionalCents: number;
  readonly invoiceFunctionalCents: number;
  readonly exchangeDifferenceFunctionalCents: number;
  readonly functionalCurrency: string;
}
const postCustomerSettlement = (input: CustomerSettlementInput) => {
  const lines = [];
  lines.push({
    accountCode: '512',
    label: 'customer-payment-bank',
    debitCents: input.bankFunctionalCents - input.feeFunctionalCents,
    creditCents: 0,
  });
  if (input.feeFunctionalCents > 0)
    lines.push({
      accountCode: '627',
      label: 'customer-payment-fee',
      debitCents: input.feeFunctionalCents,
      creditCents: 0,
    });
  lines.push({
    accountCode: '411',
    label: 'customer-payment-receivable',
    debitCents: 0,
    creditCents: input.invoiceFunctionalCents,
  });
  if (input.exchangeDifferenceFunctionalCents > 0)
    lines.push({
      accountCode: '768',
      label: 'exchange-gain',
      debitCents: 0,
      creditCents: input.exchangeDifferenceFunctionalCents,
    });
  if (input.exchangeDifferenceFunctionalCents < 0)
    lines.push({
      accountCode: '668',
      label: 'exchange-loss',
      debitCents: -input.exchangeDifferenceFunctionalCents,
      creditCents: 0,
    });
  postAccountingEntry({
    sqlite: input.sqlite,
    requestId: input.requestId,
    journalKind: 'bank',
    entryDate: input.bookedOn,
    reference: input.reference,
    description: 'customer-payment-settlement',
    currency: input.functionalCurrency,
    actorUserId: input.actorUserId,
    now: input.now,
    lines,
  });
};
const reverseCustomerSettlement = (
  sqlite: Sqlite.Database,
  matchRequestId: string,
  actorUserId: string,
  now: number,
) => {
  const original = sqlite
    .prepare(
      "select id, journal_id as journalId, currency, reference from accounting_entries where request_id = ? and status = 'posted'",
    )
    .get(matchRequestId);
  const originalEntry = Schema.decodeUnknownSync(
    Schema.UndefinedOr(
      Schema.Struct({
        id: Schema.String,
        journalId: Schema.String,
        currency: CurrencyCode,
        reference: Schema.String,
      }),
    ),
  )(original);
  if (originalEntry === undefined) return;
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
      originalEntry.journalId,
      periodId,
      entryDate,
      `EXT-${originalEntry.reference}`,
      'customer-payment-settlement-reversal',
      originalEntry.currency,
      originalEntry.id,
      now,
      actorUserId,
    );
  const lines = Schema.decodeUnknownSync(
    Schema.Array(
      Schema.Struct({
        accountId: Schema.String,
        label: Schema.String,
        debit: Schema.Int,
        credit: Schema.Int,
      }),
    ),
  )(
    sqlite
      .prepare(
        'select account_id as accountId, label, debit_cents as debit, credit_cents as credit from accounting_entry_lines where entry_id = ? order by position',
      )
      .all(originalEntry.id),
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
      line.credit,
      line.debit,
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
    .run(originalEntry.id);
};

const makeBanking = Effect.gen(function* () {
  const database = yield* Database;
  const audit = yield* Audit;
  const payments = Effect.fn('Banking.payments')((invoiceId: string) =>
    Effect.try({
      try: () =>
        Schema.decodeUnknownSync(BankPaymentList)(
          database.sqlite
            .prepare(`select p.id, p.paid_on as paidOn, p.reference, p.amount_cents as amountCents, r.currency,
      p.amount_cents - coalesce((select sum(amount_cents) from bank_matches where payment_id = p.id and cancelled_at is null), 0) as availableCents
      from invoice_payments p join invoices i on i.id = p.invoice_id
      join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
      where p.invoice_id = ? and p.cancelled_at is null order by p.paid_on, p.id`)
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
          m.exchange_difference_functional_cents as exchangeDifferenceFunctionalCents,
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
              `select t.id, t.account, t.reference, t.booked_on as bookedOn, t.amount_cents as amountCents,
                t.currency, t.functional_currency as functionalCurrency, t.exchange_rate_date as exchangeRateDate,
                t.foreign_units_per_functional_unit_nanos as foreignUnitsPerFunctionalUnitNanos,
                t.functional_amount_cents as functionalAmountCents, t.description, t.imported_at as importedAt,
             coalesce((select sum(amount_cents - fee_cents) from bank_matches where transaction_id = t.id and cancelled_at is null), 0) as matchedCents,
             (select json_group_array(json_object('matchId', m.id, 'amountCents', m.amount_cents, 'feeCents', m.fee_cents, 'paymentId', m.payment_id, 'invoiceId', p.invoice_id, 'invoiceNumber', i.invoice_number, 'paymentCancelled', case when p.cancelled_at is not null then 1 else 0 end, 'exchangeDifferenceFunctionalCents', m.exchange_difference_functional_cents))
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
              currency: CurrencyCode,
            }),
          ),
        )(
          database.sqlite
            .prepare(
              `select p.id as paymentId, p.invoice_id as invoiceId,
                i.invoice_number as invoiceNumber, r.client_display_name as clientDisplayName,
                p.paid_on as paidOn, p.reference as paymentReference, r.currency,
                p.amount_cents - coalesce((select sum(amount_cents) from bank_matches
                  where payment_id = p.id and cancelled_at is null), 0) as availableCents
               from invoice_payments p
               join invoices i on i.id = p.invoice_id
               join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
                where p.cancelled_at is null and r.currency = ?
               order by p.paid_on desc, p.id limit 1000`,
            )
            .all(transaction.currency),
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
              if (score < 35) return [];
              return [{ ...candidate, amountCents, score: Math.min(score, 100), reasons }];
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
          'select booked_on as bookedOn, amount_cents as amountCents, currency, description from bank_transactions where account = ? and reference = ?',
        )
        .get(request.account.trim(), row.reference);
      if (existing !== undefined) {
        const stored = Schema.decodeUnknownSync(
          Schema.Struct({
            bookedOn: Schema.String,
            amountCents: Schema.Number,
            currency: CurrencyCode,
            description: Schema.String,
          }),
        )(existing);
        if (
          stored.bookedOn !== row.bookedOn ||
          stored.amountCents !== row.amountCents ||
          stored.currency !== row.currency ||
          stored.description !== row.description
        )
          throw new BankImportInvalid({ code: 'bank.import_invalid' });
      }
      const conversion = findCurrencyConversion(database.sqlite, row.currency, row.bookedOn);
      if (conversion === undefined) throw new BankImportInvalid({ code: 'bank.import_invalid' });
      return {
        ...row,
        ...conversion,
        functionalAmountCents: convertToFunctionalCents(
          row.amountCents,
          conversion.foreignUnitsPerFunctionalUnitNanos,
        ),
        existing: existing !== undefined,
      };
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
                  'insert into bank_transactions (id, account, reference, booked_on, amount_cents, currency, functional_currency, exchange_rate_date, foreign_units_per_functional_unit_nanos, functional_amount_cents, description, imported_at, imported_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )
                .run(
                  ulid(now),
                  request.account.trim(),
                  row.reference,
                  row.bookedOn,
                  row.amountCents,
                  row.currency,
                  row.functionalCurrency,
                  row.exchangeRateDate,
                  row.foreignUnitsPerFunctionalUnitNanos,
                  row.functionalAmountCents,
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
              .prepare(
                'select amount_cents as amountCents, currency, booked_on as bookedOn, functional_currency as functionalCurrency, foreign_units_per_functional_unit_nanos as exchangeRate from bank_transactions where id = ?',
              )
              .get(transactionId);
            if (row === undefined)
              throw new BankTransactionNotFound({ code: 'bank.transaction_not_found' });
            const transaction = Schema.decodeUnknownSync(
              Schema.Struct({
                amountCents: Schema.Number,
                currency: CurrencyCode,
                bookedOn: CalendarDate,
                functionalCurrency: CurrencyCode,
                exchangeRate: Schema.Int,
              }),
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
                `select p.amount_cents as amountCents, r.currency, r.total_cents as invoiceTotalCents,
                   r.functional_total_cents as invoiceFunctionalTotalCents, i.invoice_number as invoiceNumber
                 from invoice_payments p
                 join invoices i on i.id = p.invoice_id
                 join invoice_revisions r on r.invoice_id = i.id and r.version = i.version
                 where p.id = ? and p.cancelled_at is null`,
              )
              .get(paymentId);
            const paymentRecord = Schema.decodeUnknownSync(
              Schema.UndefinedOr(
                Schema.Struct({
                  amountCents: Schema.Number,
                  currency: CurrencyCode,
                  invoiceTotalCents: Schema.Int,
                  invoiceFunctionalTotalCents: Schema.NullOr(Schema.Int),
                  invoiceNumber: Schema.NullOr(Schema.String),
                }),
              ),
            )(payment);
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
              paymentRecord === undefined ||
              paymentRecord.currency !== transaction.currency ||
              transaction.amountCents <= 0 ||
              !Schema.is(BankMatchRequest)(request) ||
              amountCents - feeCents > transaction.amountCents - allocatedToTransaction ||
              paymentRecord.amountCents - allocatedToPayment < amountCents ||
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
            const bankFunctionalCents = convertToFunctionalCents(
              amountCents,
              transaction.exchangeRate,
            );
            let invoiceFunctionalCents = amountCents;
            if (paymentRecord.invoiceFunctionalTotalCents !== null) {
              invoiceFunctionalCents = proportionalCents(
                paymentRecord.invoiceFunctionalTotalCents,
                amountCents,
                paymentRecord.invoiceTotalCents,
              );
            }
            const exchangeDifferenceFunctionalCents = bankFunctionalCents - invoiceFunctionalCents;
            database.sqlite
              .prepare(
                'insert into bank_matches (id, transaction_id, payment_id, amount_cents, fee_cents, exchange_difference_functional_cents, request_id, matched_at, matched_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                ulid(now),
                transactionId,
                paymentId,
                amountCents,
                feeCents,
                exchangeDifferenceFunctionalCents,
                requestId,
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
              );
            postCustomerSettlement({
              sqlite: database.sqlite,
              requestId,
              actorUserId,
              now,
              bookedOn: transaction.bookedOn,
              reference: paymentRecord.invoiceNumber ?? transactionId,
              bankFunctionalCents,
              feeFunctionalCents: convertToFunctionalCents(feeCents, transaction.exchangeRate),
              invoiceFunctionalCents,
              exchangeDifferenceFunctionalCents,
              functionalCurrency: transaction.functionalCurrency,
            });
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
      catch: (cause) => {
        if (cause instanceof BankTransactionNotFound || cause instanceof BankMatchConflict)
          return cause;
        if (cause instanceof AccountingPostingUnavailable)
          return new BankMatchConflict({ code: 'bank.match_conflict' });
        return new DatabaseError({ operation: 'match.bank.transaction', cause });
      },
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
            const matchRequestId = database.sqlite
              .prepare('select request_id from bank_matches where transaction_id = ? and id = ?')
              .pluck()
              .get(transactionId, matchId);
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
            if (cancelled > 0) {
              if (Schema.is(Schema.String)(matchRequestId))
                reverseCustomerSettlement(database.sqlite, matchRequestId, actorUserId, now);
              audit.insert({
                action: 'bank.unmatched',
                actorUserId,
                resourceType: 'bank-transaction',
                resourceId: transactionId,
                metadata: { reason: reason.trim() },
                occurredAt: now,
              });
            }
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof BankTransactionNotFound || cause instanceof BankMatchConflict)
          return cause;
        if (cause instanceof AccountingPostingUnavailable)
          return new BankMatchConflict({ code: 'bank.match_conflict' });
        return new DatabaseError({ operation: 'unmatch.bank.transaction', cause });
      },
    });
    return yield* list;
  });
  const supplierPayments = Effect.fn('Banking.supplierPayments')(function* (transactionId: string) {
    const transaction = yield* get(transactionId);
    if (transaction.amountCents >= 0)
      return yield* new BankMatchConflict({ code: 'bank.match_conflict' });
    return yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SupplierBankPaymentList)(
          database.sqlite
            .prepare(
              `select b.id as batchId, i.id as invoiceId, i.reference,
                 s.display_name as supplierName, b.execution_date as executionDate,
                 item.amount_cents as amountCents,
                 item.amount_cents - coalesce(sum(m.amount_cents), 0) as availableCents,
                 coalesce(sum(m.amount_cents), 0) as matchedCents
               from supplier_payment_batch_items item
               join supplier_payment_batches b on b.id = item.batch_id
               join supplier_invoices i on i.id = item.invoice_id
               join suppliers s on s.id = i.supplier_id
                left join supplier_bank_matches m on m.batch_id = item.batch_id
                  and m.invoice_id = item.invoice_id and m.cancelled_at is null
                where i.currency = ?
                group by b.id, i.id
               having availableCents > 0
               order by abs(julianday(b.execution_date) - julianday(?)), i.reference
               limit 100`,
            )
            .all(transaction.currency, transaction.bookedOn),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.supplier.bank.payments', cause }),
    });
  });
  const supplierMatches = Effect.fn('Banking.supplierMatches')(function* (transactionId: string) {
    yield* get(transactionId);
    return yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SupplierBankMatchList)(
          database.sqlite
            .prepare(
              `select id, batch_id as batchId, invoice_id as invoiceId,
                 amount_cents as amountCents, matched_at as matchedAt,
                 cancelled_at as cancelledAt, cancellation_reason as cancellationReason
               from supplier_bank_matches where transaction_id = ?
               order by matched_at desc, id desc`,
            )
            .all(transactionId),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.supplier.bank.matches', cause }),
    });
  });
  const matchSupplier = Effect.fn('Banking.matchSupplier')(function* (
    transactionId: string,
    request: SupplierBankMatchRequest,
    actorUserId: string,
  ) {
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.try({
      try: () =>
        database.sqlite
          .transaction(() => {
            const prior = database.sqlite
              .prepare(
                'select transaction_id as transactionId, batch_id as batchId, invoice_id as invoiceId, amount_cents as amountCents from supplier_bank_matches where request_id = ?',
              )
              .get(request.requestId);
            if (prior !== undefined) {
              const saved = Schema.decodeUnknownSync(
                Schema.Struct({
                  transactionId: Schema.String,
                  batchId: Schema.String,
                  invoiceId: Schema.String,
                  amountCents: Schema.Int,
                }),
              )(prior);
              if (
                saved.transactionId === transactionId &&
                saved.batchId === request.batchId &&
                saved.invoiceId === request.invoiceId &&
                saved.amountCents === request.amountCents
              )
                return;
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            }
            const transaction = Schema.decodeUnknownSync(
              Schema.Struct({
                amountCents: Schema.Int,
                currency: CurrencyCode,
                bookedOn: CalendarDate,
                functionalCurrency: CurrencyCode,
                exchangeRate: Schema.Int,
              }),
            )(
              database.sqlite
                .prepare(
                  'select amount_cents as amountCents, currency, booked_on as bookedOn, functional_currency as functionalCurrency, foreign_units_per_functional_unit_nanos as exchangeRate from bank_transactions where id = ?',
                )
                .get(transactionId),
            );
            const payment = Schema.decodeUnknownSync(
              Schema.Struct({
                amountCents: Schema.Int,
                functionalAmountCents: Schema.Int,
                reference: Schema.String,
                currency: CurrencyCode,
              }),
            )(
              database.sqlite
                .prepare(
                  'select item.amount_cents as amountCents, item.functional_amount_cents as functionalAmountCents, i.reference, i.currency from supplier_payment_batch_items item join supplier_invoices i on i.id = item.invoice_id where item.batch_id = ? and item.invoice_id = ?',
                )
                .get(request.batchId, request.invoiceId),
            );
            if (transaction.amountCents >= 0 || transaction.currency !== payment.currency)
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            const transactionAllocated = Schema.decodeUnknownSync(Schema.Int)(
              database.sqlite
                .prepare(
                  'select coalesce(sum(amount_cents), 0) from supplier_bank_matches where transaction_id = ? and cancelled_at is null',
                )
                .pluck()
                .get(transactionId),
            );
            const paymentAllocated = Schema.decodeUnknownSync(Schema.Int)(
              database.sqlite
                .prepare(
                  'select coalesce(sum(amount_cents), 0) from supplier_bank_matches where batch_id = ? and invoice_id = ? and cancelled_at is null',
                )
                .pluck()
                .get(request.batchId, request.invoiceId),
            );
            if (
              request.amountCents > -transaction.amountCents - transactionAllocated ||
              request.amountCents > payment.amountCents - paymentAllocated
            )
              throw new BankMatchConflict({ code: 'bank.match_conflict' });
            database.sqlite
              .prepare(
                'insert into supplier_bank_matches (id, request_id, transaction_id, batch_id, invoice_id, amount_cents, matched_at, matched_by_user_id) values (?, ?, ?, ?, ?, ?, ?, ?)',
              )
              .run(
                ulid(now),
                request.requestId,
                transactionId,
                request.batchId,
                request.invoiceId,
                request.amountCents,
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
              );
            const bankFunctionalCents = convertToFunctionalCents(
              request.amountCents,
              transaction.exchangeRate,
            );
            const invoiceFunctionalCents = proportionalCents(
              payment.functionalAmountCents,
              request.amountCents,
              payment.amountCents,
            );
            const exchangeDifferenceFunctionalCents = invoiceFunctionalCents - bankFunctionalCents;
            const postingLines = [
              {
                accountCode: '401',
                label: payment.reference,
                debitCents: invoiceFunctionalCents,
                creditCents: 0,
              },
              {
                accountCode: '512',
                label: payment.reference,
                debitCents: 0,
                creditCents: bankFunctionalCents,
              },
            ];
            if (exchangeDifferenceFunctionalCents > 0)
              postingLines.push({
                accountCode: '768',
                label: payment.reference,
                debitCents: 0,
                creditCents: exchangeDifferenceFunctionalCents,
              });
            if (exchangeDifferenceFunctionalCents < 0)
              postingLines.push({
                accountCode: '668',
                label: payment.reference,
                debitCents: -exchangeDifferenceFunctionalCents,
                creditCents: 0,
              });
            postAccountingEntry({
              sqlite: database.sqlite,
              requestId: request.requestId,
              journalKind: 'bank',
              entryDate: transaction.bookedOn,
              reference: payment.reference,
              description: 'supplier-payment-settlement',
              currency: transaction.functionalCurrency,
              actorUserId,
              now,
              lines: postingLines,
            });
            database.sqlite
              .prepare(
                "update supplier_invoices set status = 'paid', updated_at = ? where id = ? and status = 'approved' and ? = (select coalesce(sum(amount_cents), 0) from supplier_bank_matches where invoice_id = ? and cancelled_at is null)",
              )
              .run(now, request.invoiceId, payment.amountCents, request.invoiceId);
            audit.insert({
              action: 'bank.supplier-matched',
              actorUserId,
              resourceType: 'bank-transaction',
              resourceId: transactionId,
              metadata: {
                invoiceId: request.invoiceId,
                batchId: request.batchId,
                amountCents: String(request.amountCents),
              },
              occurredAt: now,
            });
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof BankMatchConflict) return cause;
        if (cause instanceof AccountingPostingUnavailable)
          return new BankMatchConflict({ code: 'bank.match_conflict' });
        return new DatabaseError({ operation: 'match.supplier.bank.payment', cause });
      },
    });
    return yield* supplierPayments(transactionId);
  });
  const unmatchSupplier = Effect.fn('Banking.unmatchSupplier')(function* (
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
            const saved = Schema.decodeUnknownSync(
              Schema.Struct({ requestId: Schema.String, invoiceId: Schema.String }),
            )(
              database.sqlite
                .prepare(
                  'select request_id as requestId, invoice_id as invoiceId from supplier_bank_matches where id = ? and transaction_id = ? and cancelled_at is null',
                )
                .get(matchId, transactionId),
            );
            database.sqlite
              .prepare(
                'update supplier_bank_matches set cancelled_at = ?, cancelled_by_user_id = ?, cancellation_reason = ? where id = ?',
              )
              .run(
                DateTime.formatIso(DateTime.makeUnsafe(now)),
                actorUserId,
                reason.trim(),
                matchId,
              );
            reverseCustomerSettlement(database.sqlite, saved.requestId, actorUserId, now);
            const settlement = Schema.decodeUnknownSync(
              Schema.Struct({ expectedCents: Schema.Int, matchedCents: Schema.Int }),
            )(
              database.sqlite
                .prepare(
                  `select item.amount_cents as expectedCents,
                     coalesce((select sum(m.amount_cents) from supplier_bank_matches m
                       where m.invoice_id = item.invoice_id and m.cancelled_at is null), 0)
                       as matchedCents
                   from supplier_payment_batch_items item where item.invoice_id = ?`,
                )
                .get(saved.invoiceId),
            );
            database.sqlite
              .prepare(
                "update supplier_invoices set status = ?, updated_at = ? where id = ? and status in ('approved', 'paid')",
              )
              .run(
                settlement.matchedCents === settlement.expectedCents ? 'paid' : 'approved',
                now,
                saved.invoiceId,
              );
            audit.insert({
              action: 'bank.supplier-unmatched',
              actorUserId,
              resourceType: 'bank-transaction',
              resourceId: transactionId,
              metadata: { invoiceId: saved.invoiceId, reason: reason.trim() },
              occurredAt: now,
            });
          })
          .immediate(),
      catch: (cause) => {
        if (cause instanceof BankMatchConflict) return cause;
        if (cause instanceof AccountingPostingUnavailable)
          return new BankMatchConflict({ code: 'bank.match_conflict' });
        return new DatabaseError({ operation: 'unmatch.supplier.bank.payment', cause });
      },
    });
    return yield* supplierPayments(transactionId);
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
    supplierPayments,
    supplierMatches,
    matchSupplier,
    unmatchSupplier,
  };
});
export class Banking extends Context.Service<Banking, Effect.Success<typeof makeBanking>>()(
  '@froment/api/Banking',
) {}
export const BankingLive = Layer.effect(Banking, makeBanking);
