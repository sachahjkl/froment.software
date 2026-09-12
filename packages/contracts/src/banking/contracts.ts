import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import { PositiveSafeInteger, SafeInteger } from '../documents/lines.js';
import { CurrencyCode } from '../company/contracts.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const BankImportMaximumContentLength = 500_000;
export const BankImportMaximumRowCount = 1_000;
export const BankImportMaximumRecordLength = 10_000;
export const BankImportMaximumColumnNameLength = 100;
export const BankImportFormat = Schema.Literals(['camt.053', 'ofx', 'csv']);
export type BankImportFormat = typeof BankImportFormat.Type;
export const BankCsvConfiguration = Schema.Struct({
  delimiter: Schema.Literals([',', ';', '\t']),
  referenceColumn: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(BankImportMaximumColumnNameLength),
  ),
  bookedOnColumn: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(BankImportMaximumColumnNameLength),
  ),
  amountColumn: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(BankImportMaximumColumnNameLength),
  ),
  currencyColumn: Schema.String.check(Schema.isMaxLength(BankImportMaximumColumnNameLength)),
  descriptionColumn: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(BankImportMaximumColumnNameLength),
  ),
  dateFormat: Schema.Literals(['yyyy-MM-dd', 'dd/MM/yyyy']),
  decimalSeparator: Schema.Literals(['.', ',']),
});
export type BankCsvConfiguration = typeof BankCsvConfiguration.Type;
export const DefaultBankCsvConfiguration: BankCsvConfiguration = {
  delimiter: ',',
  referenceColumn: 'transaction_id',
  bookedOnColumn: 'booked_on',
  amountColumn: 'amount',
  currencyColumn: 'currency',
  descriptionColumn: 'description',
  dateFormat: 'yyyy-MM-dd',
  decimalSeparator: '.',
};
export const BankImportRequest = Schema.Struct({
  account: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(100)),
  format: BankImportFormat,
  content: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(BankImportMaximumContentLength),
  ),
  csvConfiguration: Schema.NullOr(BankCsvConfiguration),
}).check(
  Schema.makeFilter(
    ({ format, csvConfiguration }) =>
      (format === 'csv' && csvConfiguration !== null) ||
      (format !== 'csv' && csvConfiguration === null),
    { message: 'bank.import_configuration_invalid' },
  ),
);
export type BankImportRequest = typeof BankImportRequest.Type;
export const BankAllocation = Schema.Struct({
  feeCents: SafeInteger,
  matchId: Ulid,
  paymentId: Ulid,
  invoiceId: Ulid,
  invoiceNumber: Schema.NullOr(Schema.String),
  amountCents: PositiveSafeInteger,
  paymentCancelled: Schema.Boolean,
  exchangeDifferenceFunctionalCents: SafeInteger,
});
export const BankTransaction = Schema.Struct({
  id: Ulid,
  account: Schema.String,
  reference: Schema.String,
  bookedOn: CalendarDate,
  amountCents: Schema.Int,
  currency: CurrencyCode,
  functionalCurrency: CurrencyCode,
  exchangeRateDate: CalendarDate,
  foreignUnitsPerFunctionalUnitNanos: PositiveSafeInteger,
  functionalAmountCents: Schema.Int,
  description: Schema.String,
  importedAt: IsoUtc,
  matchedCents: SafeInteger,
  allocations: Schema.Array(BankAllocation),
});
export const BankTransactionList = Schema.Array(BankTransaction);
export const BankPaymentList = Schema.Array(
  Schema.Struct({
    id: Ulid,
    paidOn: CalendarDate,
    reference: Schema.String,
    amountCents: PositiveSafeInteger,
    availableCents: SafeInteger,
    currency: CurrencyCode,
  }),
);
export const BankMatchHistory = Schema.Array(
  Schema.Struct({
    id: Ulid,
    paymentId: Ulid,
    feeCents: SafeInteger,
    amountCents: PositiveSafeInteger,
    invoiceId: Ulid,
    invoiceNumber: Schema.NullOr(Schema.String),
    matchedAt: IsoUtc,
    matchedByUserId: Ulid,
    cancelledAt: Schema.NullOr(IsoUtc),
    cancelledByUserId: Schema.NullOr(Ulid),
    cancellationReason: Schema.NullOr(Schema.String),
    exchangeDifferenceFunctionalCents: SafeInteger,
  }),
);
export const BankSuggestionLimit = 10;
export const BankMatchSuggestionReason = Schema.Literals([
  'exact-amount',
  'close-amount',
  'invoice-reference',
  'payment-reference',
  'close-date',
]);
export const BankMatchSuggestion = Schema.Struct({
  paymentId: Ulid,
  invoiceId: Ulid,
  invoiceNumber: Schema.NullOr(Schema.String),
  clientDisplayName: Schema.String,
  paidOn: CalendarDate,
  paymentReference: Schema.String,
  amountCents: PositiveSafeInteger,
  currency: CurrencyCode,
  score: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 100 })),
  reasons: Schema.Array(BankMatchSuggestionReason).check(Schema.isMinLength(1)),
});
export const BankMatchSuggestionList = Schema.Array(BankMatchSuggestion).check(
  Schema.isMaxLength(BankSuggestionLimit),
);
export type BankTransaction = typeof BankTransaction.Type;
export const BankImportResult = Schema.Struct({ added: Schema.Int, existing: Schema.Int });
export const BankImportPreview = Schema.Struct({
  ...BankImportResult.fields,
  rows: Schema.Array(
    Schema.Struct({
      reference: Schema.String,
      bookedOn: CalendarDate,
      amountCents: Schema.Int,
      currency: CurrencyCode,
      functionalCurrency: CurrencyCode,
      exchangeRateDate: CalendarDate,
      foreignUnitsPerFunctionalUnitNanos: PositiveSafeInteger,
      functionalAmountCents: Schema.Int,
      description: Schema.String,
      existing: Schema.Boolean,
    }),
  ),
});
export const BankMatchRequest = Schema.Struct({
  feeCents: SafeInteger,
  requestId: Schema.String.check(Schema.isUUID(4)),
  paymentId: Ulid,
  amountCents: PositiveSafeInteger,
}).check(
  Schema.makeFilter((request) => request.feeCents < request.amountCents, {
    message: 'bank.invalid_fee',
  }),
);
export const BankUnmatchRequest = Schema.Struct({
  matchId: Ulid,
  reason: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(500)),
});
export const SupplierBankPayment = Schema.Struct({
  batchId: Ulid,
  invoiceId: Ulid,
  reference: Schema.String,
  supplierName: Schema.String,
  executionDate: CalendarDate,
  amountCents: PositiveSafeInteger,
  availableCents: SafeInteger,
  matchedCents: SafeInteger,
});
export const SupplierBankPaymentList = Schema.Array(SupplierBankPayment);
export const SupplierBankMatch = Schema.Struct({
  id: Ulid,
  batchId: Ulid,
  invoiceId: Ulid,
  amountCents: PositiveSafeInteger,
  matchedAt: IsoUtc,
  cancelledAt: Schema.NullOr(IsoUtc),
  cancellationReason: Schema.NullOr(Schema.String),
});
export const SupplierBankMatchList = Schema.Array(SupplierBankMatch);
export const SupplierBankMatchRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  batchId: Ulid,
  invoiceId: Ulid,
  amountCents: PositiveSafeInteger,
});
export type SupplierBankMatchRequest = typeof SupplierBankMatchRequest.Type;
export const SupplierBankUnmatchRequest = Schema.Struct({
  matchId: Ulid,
  reason: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(500)),
});
export class BankImportInvalid extends Schema.TaggedError<BankImportInvalid>()(
  'BankImportInvalid',
  { code: Schema.Literal('bank.import_invalid') },
  { httpApiStatus: 422 },
) {}
export class BankMatchConflict extends Schema.TaggedError<BankMatchConflict>()(
  'BankMatchConflict',
  { code: Schema.Literal('bank.match_conflict') },
  { httpApiStatus: 409 },
) {}
export class BankTransactionNotFound extends Schema.TaggedError<BankTransactionNotFound>()(
  'BankTransactionNotFound',
  { code: Schema.Literal('bank.transaction_not_found') },
  { httpApiStatus: 404 },
) {}
export const BankFailure = Schema.Union([
  BankImportInvalid,
  BankMatchConflict,
  BankTransactionNotFound,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
]);
