import {
  type InvoiceDetailValue,
  type InvoiceStatusValue,
  type OrderSummaryValue,
  type QuoteDetailValue,
} from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { translate, type Language } from '@froment/l10n';
import { type IconName } from '@shared/icon/icon';
import { type affairContext } from '../affairs/affair-filters';
import {
  type DocumentBadge,
  invoiceFinancialBadge,
  invoiceStatusBadge,
  quoteStatusBadge,
} from '../commercial-header';

export function invoiceSummaryBadge(status: InvoiceStatusValue): DocumentBadge {
  return { ...invoiceStatusBadge(status), label: `backOffice.invoice.status.${status}` };
}

export function invoiceReference(number: string | null, language: Language): string {
  return number ?? translate(language, 'commercialHeader.draftInvoice');
}

export interface AffairDocument {
  readonly kind: 'quote' | 'order' | 'invoice';
  readonly label: TranslationKey;
  readonly icon: IconName;
  readonly reference: string;
  readonly link: readonly [string, string];
  readonly query: ReturnType<typeof affairContext> | undefined;
  readonly badges: readonly DocumentBadge[];
  readonly date: string;
  readonly dateLabel: TranslationKey;
  readonly totalCents: number;
}

export function affairDocuments(
  quote: QuoteDetailValue,
  order: OrderSummaryValue | undefined,
  invoice: InvoiceDetailValue | undefined,
  context: ReturnType<typeof affairContext>,
  language: Language,
): readonly AffairDocument[] {
  const documents: AffairDocument[] = [
    {
      kind: 'quote',
      label: 'backOffice.affair.quote',
      icon: 'folder',
      reference: quote.reference,
      link: ['/backoffice/quotes', quote.id],
      query: context,
      badges: [quoteStatusBadge(quote.status)],
      date: quote.currentRevision.createdAt,
      dateLabel: 'commercial.updated',
      totalCents: quote.currentRevision.totalCents,
    },
  ];
  if (order)
    documents.push({
      kind: 'order',
      label: 'backOffice.affair.order',
      icon: 'check',
      reference: order.reference,
      link: ['/backoffice/orders', order.id],
      query: context,
      badges: [{ label: 'backOffice.affair.confirmed', variant: 'success' }],
      date: order.createdAt,
      dateLabel: 'commercial.confirmedAt',
      totalCents: order.totalCents,
    });
  if (invoice)
    documents.push({
      kind: 'invoice',
      label: 'backOffice.affair.invoice',
      icon: 'invoice',
      reference: invoiceReference(invoice.invoiceNumber, language),
      link: ['/backoffice/invoices', invoice.id],
      query: undefined,
      badges:
        invoice.status === 'issued' || invoice.status === 'paid'
          ? [invoiceStatusBadge(invoice.status), invoiceFinancialBadge(invoice)]
          : [invoiceStatusBadge(invoice.status)],
      date: invoice.issuedAt ?? invoice.currentRevision.createdAt,
      dateLabel: invoice.issuedAt === null ? 'billingWorkspace.revised' : 'billingWorkspace.issued',
      totalCents: invoice.currentRevision.totalCents,
    });
  return documents;
}
