import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
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
export const BankTransaction = Schema.Struct({
  matchId: Schema.NullOr(Ulid),
  id: Ulid,
  account: Schema.String,
  reference: Schema.String,
  bookedOn: CalendarDate,
  amountCents: Schema.Int,
  description: Schema.String,
  importedAt: IsoUtc,
  paymentId: Schema.NullOr(Ulid),
  invoiceId: Schema.NullOr(Ulid),
  invoiceNumber: Schema.NullOr(Schema.String),
  paymentCancelled: Schema.Boolean,
});
export const BankTransactionList = Schema.Array(BankTransaction);
export const BankMatchHistory = Schema.Array(
  Schema.Struct({
    id: Ulid,
    paymentId: Ulid,
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
export const BankMatchRequest = Schema.Struct({ paymentId: Ulid });
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
