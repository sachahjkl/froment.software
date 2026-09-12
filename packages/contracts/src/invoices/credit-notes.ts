import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import {
  DocumentLine,
  PositiveSafeInteger,
  SafeInteger,
  documentTotalsFilter,
} from '../documents/lines.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  RequestInvalidOrigin,
  RequestTooLarge,
} from '../authentication/contracts.js';

export const CreditNoteMaximumLineCount = 100;
export const CreditNoteReasonMaximumLength = 1_000;
export const CreditNoteLineRequest = Schema.Struct({
  invoiceId: Ulid,
  invoiceVersion: PositiveSafeInteger,
  sourceLineId: Ulid,
  quantityMilli: PositiveSafeInteger,
});
export const CreditNoteDraftRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  reason: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(CreditNoteReasonMaximumLength),
  ),
  lines: Schema.Array(CreditNoteLineRequest).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(CreditNoteMaximumLineCount),
  ),
});
export const CreditNoteDraftUpdate = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  reason: CreditNoteDraftRequest.fields.reason,
  lines: CreditNoteDraftRequest.fields.lines,
});
export const CreditNoteIssueRequest = Schema.Struct({
  requestId: CreditNoteDraftRequest.fields.requestId,
  expectedVersion: PositiveSafeInteger,
});
export const CreditNoteLine = Schema.Struct({
  ...DocumentLine.fields,
  invoiceId: Ulid,
  invoiceVersion: PositiveSafeInteger,
  invoiceNumber: Schema.String,
  sourceLineId: Ulid,
});
export const CreditNoteStatus = Schema.Literals(['draft', 'issued']);
export const CreditNoteRevision = Schema.Struct({
  id: Ulid,
  version: PositiveSafeInteger,
  reason: CreditNoteDraftRequest.fields.reason,
  createdAt: IsoUtc,
  createdByUserId: Ulid,
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: PositiveSafeInteger,
  lines: Schema.Array(CreditNoteLine).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(CreditNoteMaximumLineCount),
  ),
}).check(documentTotalsFilter);
export const CreditNote = Schema.Struct({
  id: Ulid,
  clientId: Ulid,
  status: CreditNoteStatus,
  version: PositiveSafeInteger,
  requestId: CreditNoteDraftRequest.fields.requestId,
  issueRequestId: Schema.NullOr(CreditNoteDraftRequest.fields.requestId),
  number: Schema.NullOr(Schema.String.check(Schema.isPattern(/^AV-\d{4}-\d{6}$/))),
  reason: CreditNoteDraftRequest.fields.reason,
  currency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
  createdAt: IsoUtc,
  createdByUserId: Ulid,
  issuedAt: Schema.NullOr(IsoUtc),
  issuedByUserId: Schema.NullOr(Ulid),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: PositiveSafeInteger,
  lines: Schema.Array(CreditNoteLine).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(CreditNoteMaximumLineCount),
  ),
  revisions: Schema.Array(CreditNoteRevision).check(Schema.isMinLength(1)),
}).check(
  documentTotalsFilter,
  Schema.makeFilter((credit) =>
    credit.status === 'draft'
      ? credit.number === null &&
        credit.issueRequestId === null &&
        credit.issuedAt === null &&
        credit.issuedByUserId === null
      : credit.number !== null &&
        credit.issueRequestId !== null &&
        credit.issuedAt !== null &&
        credit.issuedByUserId !== null,
  ),
  Schema.makeFilter((credit) => {
    const current = credit.revisions.find((revision) => revision.version === credit.version);
    return (
      current !== undefined &&
      current.reason === credit.reason &&
      current.netTotalCents === credit.netTotalCents &&
      current.vatTotalCents === credit.vatTotalCents &&
      current.totalCents === credit.totalCents
    );
  }),
);
export const InvoiceRefundRequest = Schema.Struct({
  requestId: CreditNoteDraftRequest.fields.requestId,
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
  creditNotes: Schema.Array(CreditNote),
  refunds: Schema.Array(InvoiceRefund),
  refundableCents: SafeInteger,
});
export const CreditNoteSummary = Schema.Struct({
  id: CreditNote.fields.id,
  clientId: CreditNote.fields.clientId,
  clientDisplayName: Schema.String,
  status: CreditNote.fields.status,
  version: CreditNote.fields.version,
  number: CreditNote.fields.number,
  reason: CreditNote.fields.reason,
  currency: CreditNote.fields.currency,
  createdAt: CreditNote.fields.createdAt,
  issuedAt: CreditNote.fields.issuedAt,
  totalCents: CreditNote.fields.totalCents,
  sourceInvoiceIds: Schema.Array(Ulid).check(Schema.isMinLength(1)),
  sourceInvoiceNumbers: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
});
export class InvoiceCreditConflict extends Schema.TaggedError<InvoiceCreditConflict>()(
  'InvoiceCreditConflict',
  { code: Schema.Literal('invoice.credit_conflict') },
  { httpApiStatus: 409 },
) {}
export class InvoiceCreditRequestConflict extends Schema.TaggedError<InvoiceCreditRequestConflict>()(
  'InvoiceCreditRequestConflict',
  { code: Schema.Literal('invoice.credit_request_conflict') },
  { httpApiStatus: 409 },
) {}
export const InvoiceCreditFailure = Schema.Union([
  InvoiceCreditConflict,
  InvoiceCreditRequestConflict,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  RequestInvalidOrigin,
  RequestTooLarge,
]);
