import {
  type InvoiceDetailValue,
  type InvoiceStatusValue,
  type QuoteStatusValue,
} from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type BadgeVariant } from '@shared/badge/badge';
import { activePaidCents, documentStatusKey, financialStatus } from './billing/billing-state';
import { type AffairView } from './affairs/affair-filters';

export interface DocumentBadge {
  readonly label: TranslationKey;
  readonly variant: BadgeVariant;
}

export function commercialDocumentTitle(reference: string | null, title: string): string {
  return reference === null ? title : `${reference} · ${title}`;
}

export interface CommercialBackLink {
  readonly link: readonly ['/backoffice/affaires', string];
  readonly label: 'commercial.backAffair' | 'backOffice.backToAffairs';
}

export function commercialAffairBack(
  quoteId: string | undefined,
  view: AffairView | undefined,
): CommercialBackLink {
  return quoteId === undefined
    ? { link: ['/backoffice/affaires', view ?? 'attention'], label: 'backOffice.backToAffairs' }
    : { link: ['/backoffice/affaires', quoteId], label: 'commercial.backAffair' };
}

const quoteVariants = {
  draft: 'default',
  sent: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'warning',
  cancelled: 'danger',
} as const satisfies Record<QuoteStatusValue, BadgeVariant>;

export function quoteStatusBadge(status: QuoteStatusValue): DocumentBadge {
  return { label: `backOffice.quote.status.${status}`, variant: quoteVariants[status] };
}

const invoiceVariants = {
  draft: 'default',
  issued: 'success',
  paid: 'success',
  void: 'danger',
} as const satisfies Record<InvoiceStatusValue, BadgeVariant>;

export function invoiceStatusBadge(status: InvoiceStatusValue): DocumentBadge {
  return { label: documentStatusKey(status), variant: invoiceVariants[status] };
}

export function invoiceFinancialBadge(invoice: InvoiceDetailValue): DocumentBadge {
  const label = financialStatus({
    ...invoice,
    recordedPaidCents: activePaidCents(invoice),
    totalCents: invoice.currentRevision.totalCents,
  });
  switch (label) {
    case 'billingWorkspace.paid':
    case 'billingWorkspace.credited':
      return { label, variant: 'success' };
    case 'billingWorkspace.partial':
    case 'billingWorkspace.unpaid':
      return { label, variant: 'warning' };
    default:
      return { label, variant: 'default' };
  }
}
