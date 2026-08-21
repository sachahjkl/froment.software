import { Schema } from 'effect';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from './authentication.js';
import { DisplayName, Ulid } from './identifiers.js';
import {
  DocumentLines,
  PositiveSafeInteger,
  SafeInteger,
  documentTotalsFilter,
} from './document-lines.js';
import { DocumentNotFound, DocumentParty, IssuerSettings, QuoteLineInput } from './quotes.js';
import { CalendarDate, IsoUtc } from './temporal.js';
import {
  InvoiceNumber,
  OrderReference,
  QuoteReference,
  StoredInvoiceNumber,
} from './business-references.js';

export { CalendarDate, CalendarDateText } from './temporal.js';
const InvoiceTitle = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));
const PaymentTerms = Schema.String.check(Schema.isMaxLength(2_000));
const InvoiceLinesInput = Schema.Array(QuoteLineInput).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(20),
);

export const InvoiceStatus = Schema.Literals(['draft', 'issued', 'paid', 'void']);
export type InvoiceStatus = typeof InvoiceStatus.Type;

export { InvoiceNumber } from './business-references.js';
export type { InvoiceNumber as InvoiceNumberType } from './business-references.js';

export const InvoicePdfStatus = Schema.Literals(['pending', 'processing', 'ready', 'failed']);
export type InvoicePdfStatus = typeof InvoicePdfStatus.Type;

export const InvoicePdfState = Schema.Struct({
  status: InvoicePdfStatus,
  attempts: SafeInteger,
  error: Schema.NullOr(Schema.Literal('pdf.render_failed')),
});
export type InvoicePdfState = typeof InvoicePdfState.Type;

export const InvoiceCreateRequest = Schema.Struct({
  orderId: Ulid,
  serviceDate: CalendarDate,
  dueDate: CalendarDate,
  paymentTerms: PaymentTerms,
});
export type InvoiceCreateRequest = typeof InvoiceCreateRequest.Type;

export const InvoiceRevisionCreateRequest = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  title: InvoiceTitle,
  serviceDate: CalendarDate,
  dueDate: CalendarDate,
  paymentTerms: PaymentTerms,
  lines: InvoiceLinesInput,
});
export type InvoiceRevisionCreateRequest = typeof InvoiceRevisionCreateRequest.Type;

export const InvoiceIssueRequest = Schema.Struct({ expectedVersion: PositiveSafeInteger });
export type InvoiceIssueRequest = typeof InvoiceIssueRequest.Type;

export const InvoiceTransitionRequest = Schema.Struct({ expectedVersion: PositiveSafeInteger });
export type InvoiceTransitionRequest = typeof InvoiceTransitionRequest.Type;

const InvoiceRenderSnapshotV1 = Schema.Struct({
  templateId: Schema.Literal('invoice-default'),
  templateVersion: Schema.Literal(1),
  invoiceId: Ulid,
  orderId: Ulid,
  revisionId: Ulid,
  version: PositiveSafeInteger,
  createdAt: IsoUtc,
  invoiceNumber: Schema.NullOr(StoredInvoiceNumber),
  issuedAt: Schema.NullOr(IsoUtc),
  serviceDate: CalendarDate,
  dueDate: CalendarDate,
  issuer: IssuerSettings,
  client: DocumentParty,
  title: InvoiceTitle,
  paymentTerms: PaymentTerms,
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  lines: DocumentLines,
}).check(documentTotalsFilter);
const InvoiceRenderSnapshotV2 = Schema.Struct({
  ...InvoiceRenderSnapshotV1.fields,
  templateVersion: Schema.Literal(2),
  quoteReference: QuoteReference,
  orderReference: OrderReference,
}).check(documentTotalsFilter);
export const InvoiceRenderSnapshot = Schema.Union([
  InvoiceRenderSnapshotV1,
  InvoiceRenderSnapshotV2,
]);
export type InvoiceRenderSnapshot = typeof InvoiceRenderSnapshot.Type;

export const InvoiceRevision = Schema.Struct({
  id: Ulid,
  version: PositiveSafeInteger,
  clientDisplayName: DisplayName,
  invoiceNumber: Schema.NullOr(StoredInvoiceNumber),
  issuedAt: Schema.NullOr(IsoUtc),
  title: InvoiceTitle,
  serviceDate: CalendarDate,
  dueDate: CalendarDate,
  paymentTerms: PaymentTerms,
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  createdByUserId: Ulid,
  lines: DocumentLines,
}).check(documentTotalsFilter);
export type InvoiceRevision = typeof InvoiceRevision.Type;

export const InvoiceSummary = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: OrderReference,
  clientId: Ulid,
  clientDisplayName: DisplayName,
  status: InvoiceStatus,
  version: PositiveSafeInteger,
  invoiceNumber: Schema.NullOr(StoredInvoiceNumber),
  title: InvoiceTitle,
  dueDate: CalendarDate,
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  updatedAt: IsoUtc,
  pdf: Schema.NullOr(InvoicePdfState),
});
export type InvoiceSummary = typeof InvoiceSummary.Type;

export const InvoiceDetail = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: OrderReference,
  clientId: Ulid,
  status: InvoiceStatus,
  version: PositiveSafeInteger,
  invoiceNumber: Schema.NullOr(StoredInvoiceNumber),
  issuedAt: Schema.NullOr(IsoUtc),
  paidAt: Schema.NullOr(IsoUtc),
  voidedAt: Schema.NullOr(IsoUtc),
  currentRevision: InvoiceRevision,
  revisions: Schema.Array(InvoiceRevision),
  pdf: Schema.NullOr(InvoicePdfState),
});
export type InvoiceDetail = typeof InvoiceDetail.Type;

export const InvoiceIssueResult = Schema.Struct({
  invoiceId: Ulid,
  revisionId: Ulid,
  version: PositiveSafeInteger,
  status: Schema.Literal('issued'),
  invoiceNumber: InvoiceNumber,
  issuedAt: IsoUtc,
});
export type InvoiceIssueResult = typeof InvoiceIssueResult.Type;

export const InvoiceDocumentArtifact = Schema.Struct({
  id: Ulid,
  invoiceNumber: StoredInvoiceNumber,
  invoiceRevisionId: Ulid,
  kind: Schema.Literal('invoice-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: PositiveSafeInteger,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  createdAt: IsoUtc,
});
export type InvoiceDocumentArtifact = typeof InvoiceDocumentArtifact.Type;

export const InvoiceList = Schema.Array(InvoiceSummary);
export type InvoiceList = typeof InvoiceList.Type;

export class InvoiceNotFound extends Schema.TaggedError<InvoiceNotFound>()(
  'InvoiceNotFound',
  { code: Schema.Literal('invoice.not_found') },
  { httpApiStatus: 404 },
) {}

export class InvoiceOrderNotFound extends Schema.TaggedError<InvoiceOrderNotFound>()(
  'InvoiceOrderNotFound',
  { code: Schema.Literal('invoice.order_not_found') },
  { httpApiStatus: 404 },
) {}

export class InvoiceAlreadyExists extends Schema.TaggedError<InvoiceAlreadyExists>()(
  'InvoiceAlreadyExists',
  { code: Schema.Literal('invoice.already_exists'), invoiceId: Ulid },
  { httpApiStatus: 409 },
) {}

export class InvoiceNotEditable extends Schema.TaggedError<InvoiceNotEditable>()(
  'InvoiceNotEditable',
  { code: Schema.Literal('invoice.not_editable') },
  { httpApiStatus: 409 },
) {}

export class InvoiceVersionConflict extends Schema.TaggedError<InvoiceVersionConflict>()(
  'InvoiceVersionConflict',
  { code: Schema.Literal('invoice.version_conflict'), currentVersion: PositiveSafeInteger },
  { httpApiStatus: 409 },
) {}

export class InvoiceAmountTooLarge extends Schema.TaggedError<InvoiceAmountTooLarge>()(
  'InvoiceAmountTooLarge',
  { code: Schema.Literal('invoice.amount_too_large') },
  { httpApiStatus: 422 },
) {}

export class InvoiceInvalidDates extends Schema.TaggedError<InvoiceInvalidDates>()(
  'InvoiceInvalidDates',
  { code: Schema.Literal('invoice.invalid_dates') },
  { httpApiStatus: 422 },
) {}

export class InvoiceInvalidTransition extends Schema.TaggedError<InvoiceInvalidTransition>()(
  'InvoiceInvalidTransition',
  { code: Schema.Literal('invoice.invalid_transition'), currentStatus: InvoiceStatus },
  { httpApiStatus: 409 },
) {}

export const InvoiceFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  RequestRateLimited,
  InvoiceNotFound,
  InvoiceOrderNotFound,
  InvoiceAlreadyExists,
  InvoiceNotEditable,
  InvoiceVersionConflict,
  InvoiceAmountTooLarge,
  InvoiceInvalidDates,
  InvoiceInvalidTransition,
  DocumentNotFound,
]);
export type InvoiceFailure = typeof InvoiceFailure.Type;
