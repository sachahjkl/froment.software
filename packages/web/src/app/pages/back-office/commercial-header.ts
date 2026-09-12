import {
  type InvoiceDetailValue,
  type InvoiceStatusValue,
  type QuoteStatusValue,
} from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type BadgeVariant } from '@shared/badge/badge';
import { activePaidCents, documentStatusKey, financialStatus } from './billing/billing-state';
import { type affairContext } from './affairs/affair-filters';
import { type BreadcrumbItem } from '@shared/breadcrumbs/breadcrumbs';
import { translate, type Language } from '@froment/l10n';

export interface DocumentBadge {
  readonly label: TranslationKey;
  readonly variant: BadgeVariant;
}

export function commercialDocumentTitle(reference: string | null, title: string): string {
  return reference === null ? title : `${reference} · ${title}`;
}

export function commercialBreadcrumbs(
  affair: { readonly id: string; readonly reference: string } | undefined,
  context: ReturnType<typeof affairContext>,
  language: Language,
): readonly BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    {
      path: ['/backoffice/affairs', context.view ?? 'attention'],
      queryParams: context,
      label: translate(language, 'backOffice.affairs.title'),
    },
  ];
  if (affair)
    items.push({
      path: ['/backoffice/affairs', affair.id],
      queryParams: context,
      label: affair.reference,
    });
  return items;
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
