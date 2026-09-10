import {
  type ClientInvoiceSummaryValue,
  type ClientOrderSummaryValue,
  type ClientQuoteSummaryValue,
} from '@froment/contracts';
import { Schema } from 'effect';

export const PortalDocumentKind = Schema.Literals(['quote', 'order', 'invoice']);
export type PortalDocumentKind = typeof PortalDocumentKind.Type;

export interface PortalDocument {
  readonly id: string;
  readonly kind: PortalDocumentKind;
  readonly title: string;
  readonly reference: string;
  readonly status: string;
  readonly totalCents: number;
  readonly currency: string;
  readonly date: string;
  readonly open: boolean;
  readonly pdfAvailable: boolean;
  readonly quote?: ClientQuoteSummaryValue;
  readonly order?: ClientOrderSummaryValue;
  readonly invoice?: ClientInvoiceSummaryValue;
}

export const portalDocuments = (
  quotes: readonly ClientQuoteSummaryValue[],
  orders: readonly ClientOrderSummaryValue[],
  invoices: readonly ClientInvoiceSummaryValue[],
): readonly PortalDocument[] =>
  [
    ...quotes.map((quote): PortalDocument => ({
      ...quote,
      kind: 'quote',
      date: quote.updatedAt,
      open: quote.status === 'sent',
      quote,
    })),
    ...orders.map((order): PortalDocument => ({
      ...order,
      kind: 'order',
      date: order.createdAt,
      open: order.invoiceId === null,
      order,
    })),
    ...invoices.map((invoice): PortalDocument => ({
      ...invoice,
      kind: 'invoice',
      reference: invoice.invoiceNumber,
      date: invoice.updatedAt,
      open: invoice.status === 'issued' && invoice.remainingCents > 0,
      invoice,
    })),
  ].sort((left, right) => right.date.localeCompare(left.date));
