import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import { PositiveSafeInteger, SafeInteger } from '../documents/lines.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const BankImportRequest = Schema.Struct({
  account: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(100)),
  csv: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500000)),
});
export type BankImportRequest = typeof BankImportRequest.Type;
export const BankAllocation = Schema.Struct({
  feeCents: SafeInteger,
  matchId: Ulid,
  paymentId: Ulid,
  invoiceId: Ulid,
  invoiceNumber: Schema.NullOr(Schema.String),
  amountCents: PositiveSafeInteger,
  paymentCancelled: Schema.Boolean,
});
export const BankTransaction = Schema.Struct({
  id: Ulid,
  account: Schema.String,
  reference: Schema.String,
  bookedOn: CalendarDate,
  amountCents: Schema.Int,
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
  }),
);
export type BankTransaction = typeof BankTransaction.Type;
export const BankImportResult = Schema.Struct({ added: Schema.Int, existing: Schema.Int });
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
