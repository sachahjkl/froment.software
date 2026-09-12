import { Schema } from 'effect';

import { FunctionalCurrency } from '../company/contracts.js';
import { Ulid } from '../identifiers.js';

export const SupplierInvoiceMaximumAmountCents = 9_000_000_000_000;
export const SupplierInvoiceMaximumNetAmountCents = 4_000_000_000_000;
export const SupplierInvoiceMaximumVatRateBasisPoints = 10_000;
export const SupplierInvoiceMaximumLineCount = 500;
export const SupplierInvoiceMinimumLineCount = 1;
export const SupplierInvoiceMaximumReferenceLength = 80;
export const SupplierInvoiceMaximumDescriptionLength = 500;
export const SupplierInvoiceMaximumNotesLength = 4_000;
export const SupplierInvoiceMaximumFileNameLength = 255;
export const SupplierInvoiceMoneyDecimalPlaces = 2;
export const SupplierInvoicePercentageDecimalPlaces = 2;
export const BasisPointsPerPercent = 100;
export const SupplierInvoiceAnalysisMaximumEndpointLength = 2_000;
export const SupplierInvoiceAnalysisMaximumCredentialLength = 2_000;
export const Base64QuantumLength = 4;
export const SupplierPaymentBatchMaximumInvoiceCount = 100;
export const SupplierPaymentBatchListLimit = 100;
export const SupplierPaymentBatchMaximumAmountCents =
  SupplierInvoiceMaximumAmountCents * SupplierPaymentBatchMaximumInvoiceCount;
export const SepaMaximumNameLength = 70;
export const SepaMaximumIdentifierLength = 35;

const CalendarDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
const MoneyCents = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SupplierInvoiceMaximumAmountCents }),
);
const PaymentBatchMoneyCents = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SupplierPaymentBatchMaximumAmountCents }),
);
const NetMoneyCents = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SupplierInvoiceMaximumNetAmountCents }),
);
const VatRateBasisPoints = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: SupplierInvoiceMaximumVatRateBasisPoints }),
);

export const SupplierInvoiceStatus = Schema.Literals([
  'draft',
  'confirmed',
  'approved',
  'paid',
  'cancelled',
]);
export type SupplierInvoiceStatus = typeof SupplierInvoiceStatus.Type;
export const SupplierInvoiceSource = Schema.Literals(['manual', 'ocr']);
export type SupplierInvoiceSource = typeof SupplierInvoiceSource.Type;

export const SupplierInvoiceLineInput = Schema.Struct({
  description: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(SupplierInvoiceMaximumDescriptionLength),
  ),
  netTotalCents: NetMoneyCents,
  vatRateBasisPoints: VatRateBasisPoints,
});
export type SupplierInvoiceLineInput = typeof SupplierInvoiceLineInput.Type;

export const SupplierInvoiceLine = Schema.Struct({
  id: Ulid,
  position: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  ...SupplierInvoiceLineInput.fields,
  vatTotalCents: MoneyCents,
  totalCents: MoneyCents,
});
export type SupplierInvoiceLine = typeof SupplierInvoiceLine.Type;

const fields = {
  supplierId: Ulid,
  reference: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(SupplierInvoiceMaximumReferenceLength),
  ),
  invoiceDate: CalendarDate,
  dueDate: CalendarDate,
  currency: FunctionalCurrency,
  lines: Schema.Array(SupplierInvoiceLineInput).check(
    Schema.isMinLength(SupplierInvoiceMinimumLineCount),
    Schema.isMaxLength(SupplierInvoiceMaximumLineCount),
  ),
  notes: Schema.String.check(Schema.isMaxLength(SupplierInvoiceMaximumNotesLength)),
};
const validDateOrder = Schema.makeFilter<{
  readonly invoiceDate: string;
  readonly dueDate: string;
}>(({ invoiceDate, dueDate }) => dueDate >= invoiceDate, {
  message: 'supplier_invoice.date_order_invalid',
});

export const SupplierInvoiceCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  ...fields,
  source: SupplierInvoiceSource,
  sourceFileName: Schema.NullOr(
    Schema.String.check(Schema.isMaxLength(SupplierInvoiceMaximumFileNameLength)),
  ),
  externalSubmissionId: Schema.NullOr(Ulid),
})
  .check(validDateOrder)
  .annotate({ identifier: 'SupplierInvoiceCreateRequest' });
export type SupplierInvoiceCreateRequest = typeof SupplierInvoiceCreateRequest.Type;

export const SupplierInvoiceUpdateRequest = Schema.Struct({
  ...fields,
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
})
  .check(validDateOrder)
  .annotate({ identifier: 'SupplierInvoiceUpdateRequest' });
export type SupplierInvoiceUpdateRequest = typeof SupplierInvoiceUpdateRequest.Type;

export const SupplierInvoice = Schema.Struct({
  id: Ulid,
  supplierId: Ulid,
  supplierName: Schema.String,
  reference: fields.reference,
  invoiceDate: CalendarDate,
  dueDate: CalendarDate,
  currency: FunctionalCurrency,
  lines: Schema.Array(SupplierInvoiceLine),
  notes: fields.notes,
  netTotalCents: MoneyCents,
  vatTotalCents: MoneyCents,
  totalCents: MoneyCents,
  status: SupplierInvoiceStatus,
  source: SupplierInvoiceSource,
  sourceFileName: SupplierInvoiceCreateRequest.fields.sourceFileName,
  externalSubmissionId: Schema.NullOr(Ulid),
  confirmedAt: Schema.NullOr(Schema.Int),
  approvedAt: Schema.NullOr(Schema.Int),
  version: Schema.Int.check(Schema.isGreaterThan(0)),
  createdAt: Schema.Int,
  updatedAt: Schema.Int,
}).annotate({ identifier: 'SupplierInvoice' });
export type SupplierInvoice = typeof SupplierInvoice.Type;
export const SupplierInvoiceList = Schema.Array(SupplierInvoice);
export const SupplierInvoiceTransitionRequest = Schema.Struct({
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
});

export const SupplierPaymentBatchCreateRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  executionDate: CalendarDate,
  invoiceIds: Schema.Array(Ulid).check(
    Schema.isMinLength(SupplierInvoiceMinimumLineCount),
    Schema.isMaxLength(SupplierPaymentBatchMaximumInvoiceCount),
  ),
});
export type SupplierPaymentBatchCreateRequest = typeof SupplierPaymentBatchCreateRequest.Type;
export const SupplierPaymentBatchInvoice = Schema.Struct({
  invoiceId: Ulid,
  reference: Schema.String,
  supplierName: Schema.String,
  amountCents: MoneyCents,
});
export const SupplierPaymentBatch = Schema.Struct({
  id: Ulid,
  messageId: Schema.String,
  executionDate: CalendarDate,
  transactionCount: Schema.Int.check(Schema.isGreaterThan(0)),
  controlSumCents: PaymentBatchMoneyCents,
  createdAt: Schema.Int,
  invoices: Schema.Array(SupplierPaymentBatchInvoice).check(
    Schema.isMinLength(SupplierInvoiceMinimumLineCount),
    Schema.isMaxLength(SupplierPaymentBatchMaximumInvoiceCount),
  ),
});
export type SupplierPaymentBatch = typeof SupplierPaymentBatch.Type;
export const SupplierPaymentBatchList = Schema.Array(SupplierPaymentBatch).check(
  Schema.isMaxLength(SupplierPaymentBatchListLimit),
);

export const SupplierInvoiceAnalysisAdapter = Schema.Literals(['local', 'http']);
export const SupplierInvoiceAnalysisSettings = Schema.Struct({
  adapter: SupplierInvoiceAnalysisAdapter,
  endpoint: Schema.NullOr(Schema.String),
  credentialsPresent: Schema.Boolean,
  external: Schema.Boolean,
  updatedAt: Schema.NullOr(Schema.Int),
});
export const SupplierInvoiceAnalysisStatus = Schema.Struct({
  external: Schema.Boolean,
});
export const SupplierInvoiceAnalysisSettingsUpdate = Schema.Struct({
  adapter: SupplierInvoiceAnalysisAdapter,
  endpoint: Schema.NullOr(
    Schema.String.check(
      Schema.isPattern(/^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/),
      Schema.isMaxLength(SupplierInvoiceAnalysisMaximumEndpointLength),
    ),
  ),
  apiKey: Schema.optional(
    Schema.String.check(Schema.isMaxLength(SupplierInvoiceAnalysisMaximumCredentialLength)),
  ),
});
export const SupplierInvoiceAnalysisRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  supplierId: Ulid,
  fileName: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(SupplierInvoiceMaximumFileNameLength),
  ),
  mediaType: Schema.Literals(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  contentBase64: Schema.String.check(
    Schema.isMinLength(Base64QuantumLength),
    Schema.isPattern(/^[A-Za-z0-9+/]*={0,2}$/),
  ),
  consent: Schema.Boolean,
});

export class SupplierInvoiceNotFound extends Schema.TaggedError<SupplierInvoiceNotFound>()(
  'SupplierInvoiceNotFound',
  { code: Schema.Literal('supplier_invoice.not_found') },
  { httpApiStatus: 404 },
) {}
export class SupplierPaymentBatchNotFound extends Schema.TaggedError<SupplierPaymentBatchNotFound>()(
  'SupplierPaymentBatchNotFound',
  { code: Schema.Literal('supplier_payment_batch.not_found') },
  { httpApiStatus: 404 },
) {}
export class SupplierInvoiceConflict extends Schema.TaggedError<SupplierInvoiceConflict>()(
  'SupplierInvoiceConflict',
  {
    code: Schema.Literals([
      'supplier_invoice.version_conflict',
      'supplier_invoice.creation_conflict',
      'supplier_invoice.reference_exists',
      'supplier_invoice.not_editable',
      'supplier_invoice.invalid_transition',
      'supplier_invoice.supplier_unavailable',
      'supplier_invoice.analysis_not_configured',
      'supplier_invoice.analysis_consent_required',
      'supplier_invoice.analysis_failed',
      'supplier_invoice.encryption_unavailable',
      'supplier_payment_batch.creation_conflict',
      'supplier_payment_batch.invoice_not_payable',
      'supplier_payment_batch.currency_not_supported',
      'supplier_payment_batch.debtor_account_incomplete',
      'supplier_payment_batch.creditor_account_incomplete',
      'supplier_payment_batch.party_name_too_long',
    ]),
  },
  { httpApiStatus: 409 },
) {}
export const SupplierInvoiceFailure = Schema.Union([
  SupplierInvoiceNotFound,
  SupplierPaymentBatchNotFound,
  SupplierInvoiceConflict,
]);
