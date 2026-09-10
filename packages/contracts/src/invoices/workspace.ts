import { Schema } from 'effect';
import { InvoicePayment } from './payments.js';
import { CreditNote, InvoiceRefund } from './credit-notes.js';
import { InvoiceSummary } from './contracts.js';
import { AuditEvent } from '../audit/contracts.js';

const invoiceContext = {
  invoiceId: InvoiceSummary.fields.id,
  invoiceNumber: InvoiceSummary.fields.invoiceNumber,
  title: InvoiceSummary.fields.title,
  clientId: InvoiceSummary.fields.clientId,
  clientDisplayName: InvoiceSummary.fields.clientDisplayName,
  orderId: InvoiceSummary.fields.orderId,
  orderReference: InvoiceSummary.fields.orderReference,
};

export const InvoiceReceiptList = Schema.Array(
  Schema.Struct({
    ...InvoicePayment.fields,
    ...invoiceContext,
  }),
).check(Schema.isMaxLength(10000));
export const CreditNoteList = Schema.Array(
  Schema.Struct({
    ...CreditNote.fields,
    ...invoiceContext,
  }),
).check(Schema.isMaxLength(10000));
export const InvoiceRefundList = Schema.Array(
  Schema.Struct({
    ...InvoiceRefund.fields,
    ...invoiceContext,
  }),
).check(Schema.isMaxLength(10000));
export const InvoiceHistory = Schema.Array(AuditEvent).check(Schema.isMaxLength(10000));

export class InvoiceWorkspaceLimitExceeded extends Schema.TaggedError<InvoiceWorkspaceLimitExceeded>()(
  'InvoiceWorkspaceLimitExceeded',
  { code: Schema.Literal('invoice.workspace_limit') },
  { httpApiStatus: 413 },
) {}
