import { Schema } from 'effect';

import { FunctionalCurrency } from '../company/contracts.js';
import { Ulid } from '../identifiers.js';

const CalendarDate = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));
const MoneyCents = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 9_000_000_000_000 }));
const NetMoneyCents = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 4_000_000_000_000 }),
);
const VatRateBasisPoints = Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 10_000 }));

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
  description: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(500)),
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
  reference: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(80)),
  invoiceDate: CalendarDate,
  dueDate: CalendarDate,
  currency: FunctionalCurrency,
  lines: Schema.Array(SupplierInvoiceLineInput).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500),
  ),
  notes: Schema.String.check(Schema.isMaxLength(4_000)),
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
  sourceFileName: Schema.NullOr(Schema.String.check(Schema.isMaxLength(255))),
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
  sourceFileName: Schema.NullOr(Schema.String),
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

export class SupplierInvoiceNotFound extends Schema.TaggedError<SupplierInvoiceNotFound>()(
  'SupplierInvoiceNotFound',
  { code: Schema.Literal('supplier_invoice.not_found') },
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
    ]),
  },
  { httpApiStatus: 409 },
) {}
export const SupplierInvoiceFailure = Schema.Union([
  SupplierInvoiceNotFound,
  SupplierInvoiceConflict,
]);
