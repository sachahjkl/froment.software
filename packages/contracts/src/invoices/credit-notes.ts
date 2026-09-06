import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { PositiveSafeInteger, SafeInteger } from '../documents/lines.js';
import { CalendarDate, IsoUtc } from '../temporal.js';

export const CreditNoteRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  expectedVersion: PositiveSafeInteger,
  reason: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(1000)),
});
export const CreditNote = Schema.Struct({
  id: Ulid,
  invoiceId: Ulid,
  invoiceRevisionId: Ulid,
  requestId: CreditNoteRequest.fields.requestId,
  number: Schema.String.check(Schema.isPattern(/^AV-\d{4}-\d{6}$/)),
  reason: CreditNoteRequest.fields.reason,
  issuedAt: IsoUtc,
  issuedByUserId: Ulid,
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: PositiveSafeInteger,
});
export const InvoiceRefundRequest = Schema.Struct({
  requestId: CreditNoteRequest.fields.requestId,
  amountCents: PositiveSafeInteger,
  refundedOn: CalendarDate,
  reference: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
});
export const InvoiceRefund = Schema.Struct({
  ...InvoiceRefundRequest.fields,
  id: Ulid,
  invoiceId: Ulid,
  recordedAt: IsoUtc,
  recordedByUserId: Ulid,
  cancelledAt: Schema.NullOr(IsoUtc),
  cancellationReason: Schema.NullOr(Schema.String),
  cancelledByUserId: Schema.NullOr(Ulid),
});
export const InvoiceRefundCancel = Schema.Struct({
  reason: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(500)),
});
export const InvoiceCredits = Schema.Struct({
  creditNote: Schema.NullOr(CreditNote),
  refunds: Schema.Array(InvoiceRefund),
  refundableCents: SafeInteger,
});
export class InvoiceCreditConflict extends Schema.TaggedError<InvoiceCreditConflict>()(
  'InvoiceCreditConflict',
  { code: Schema.Literal('invoice.credit_conflict') },
  { httpApiStatus: 409 },
) {}
