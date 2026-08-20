import { Schema } from 'effect';

import { CalendarDate, InvoiceNumber } from './invoices.js';
import { Ulid } from './identifiers.js';
import { IsoUtc } from './temporal.js';

const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const Title = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));

export const ClientQuoteSummary = Schema.Struct({
  id: Ulid,
  status: Schema.Literals(['sent', 'accepted', 'rejected', 'expired']),
  title: Title,
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  updatedAt: IsoUtc,
  pdfAvailable: Schema.Boolean,
});
export type ClientQuoteSummary = typeof ClientQuoteSummary.Type;

export const ClientQuoteList = Schema.Array(ClientQuoteSummary);
export type ClientQuoteList = typeof ClientQuoteList.Type;

export const ClientOrderSummary = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  status: Schema.Literal('confirmed'),
  title: Title,
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  invoiceId: Schema.NullOr(Ulid),
});
export type ClientOrderSummary = typeof ClientOrderSummary.Type;

export const ClientOrderList = Schema.Array(ClientOrderSummary);
export type ClientOrderList = typeof ClientOrderList.Type;

export const ClientInvoiceSummary = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  status: Schema.Literals(['issued', 'paid', 'void']),
  invoiceNumber: InvoiceNumber,
  title: Title,
  dueDate: CalendarDate,
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  updatedAt: IsoUtc,
  pdfAvailable: Schema.Boolean,
});
export type ClientInvoiceSummary = typeof ClientInvoiceSummary.Type;

export const ClientInvoiceList = Schema.Array(ClientInvoiceSummary);
export type ClientInvoiceList = typeof ClientInvoiceList.Type;
