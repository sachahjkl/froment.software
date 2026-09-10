import { type ParamMap } from '@angular/router';
import {
  type InvoiceDetailValue,
  type InvoiceSummaryValue,
  type InvoicePaymentValue,
} from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type BillingSort, readBillingSort } from './billing-list';
import { readBillingPeriod } from './billing-period';

export const invoiceSortColumns = [
  'number',
  'client',
  'status',
  'financial',
  'due',
  'total',
  'remaining',
] as const;
export type InvoiceSortColumn = (typeof invoiceSortColumns)[number];
export type InvoiceSort = BillingSort<InvoiceSortColumn>;
export const billingSort = (params: ParamMap): InvoiceSort =>
  readBillingSort(params, invoiceSortColumns);
export const compareInvoices = (
  left: InvoiceSummaryValue,
  right: InvoiceSummaryValue,
  sort: InvoiceSort,
  collator: Intl.Collator,
  translate: (key: TranslationKey) => string,
): number => {
  const order = sort === 'none' ? 'due-asc' : sort;
  let comparison: number;
  if (order.startsWith('due-')) {
    comparison = Date.parse(left.dueDate) - Date.parse(right.dueDate);
  } else if (order.startsWith('total-')) {
    comparison = left.totalCents - right.totalCents;
  } else if (order.startsWith('remaining-')) {
    comparison = remainingCents(left) - remainingCents(right);
  } else {
    const value = (invoice: InvoiceSummaryValue): string => {
      if (order.startsWith('client-')) return invoice.clientDisplayName;
      if (order.startsWith('status-')) return translate(documentStatusKey(invoice.status));
      if (order.startsWith('financial-')) return translate(financialStatus(invoice));
      return invoice.invoiceNumber ?? invoice.title;
    };
    comparison = collator.compare(value(left), value(right));
  }
  return (order.endsWith('-desc') ? -comparison : comparison) || left.id.localeCompare(right.id);
};

export const billingFilters = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 160),
  status: params.get('status') ?? '',
  client: params.get('client') ?? '',
  due: params.get('due') ?? '',
  credit: params.get('credit') ?? '',
  ...readBillingPeriod(params),
});
export const documentStatus = (status: InvoiceSummaryValue['status']) =>
  status === 'paid' ? 'issued' : status;
export const documentStatusKey = (status: InvoiceSummaryValue['status']): TranslationKey =>
  `backOffice.invoice.status.${documentStatus(status)}`;
export const paymentMethodKey = (method: InvoicePaymentValue['method']): TranslationKey =>
  `payment.${method}`;
export const remainingCents = (invoice: InvoiceSummaryValue) =>
  invoice.status === 'draft' || invoice.status === 'void'
    ? 0
    : Math.max(0, invoice.totalCents - invoice.creditedCents - invoice.recordedPaidCents);
export const activePaidCents = (invoice: InvoiceDetailValue) =>
  invoice.payments.reduce(
    (sum, payment) => sum + (payment.cancelledAt === null ? payment.amountCents : 0),
    0,
  );
export const detailBalance = (invoice: InvoiceDetailValue) =>
  invoice.status === 'draft' || invoice.status === 'void'
    ? 0
    : Math.max(
        0,
        invoice.currentRevision.totalCents - invoice.creditedCents - activePaidCents(invoice),
      );
export const financialStatus = (
  invoice: Pick<
    InvoiceSummaryValue,
    'status' | 'creditedCents' | 'recordedPaidCents' | 'totalCents'
  >,
): TranslationKey => {
  if (invoice.status === 'draft' || invoice.status === 'void')
    return 'billingWorkspace.notApplicable';
  if (invoice.creditedCents > 0) return 'billingWorkspace.credited';
  if (invoice.recordedPaidCents >= invoice.totalCents) return 'billingWorkspace.paid';
  return invoice.recordedPaidCents > 0 ? 'billingWorkspace.partial' : 'billingWorkspace.unpaid';
};
export const reminderEligible = (invoice: InvoiceSummaryValue, today: string) =>
  invoice.status === 'issued' &&
  invoice.creditedCents === 0 &&
  remainingCents(invoice) > 0 &&
  invoice.dueDate < today;
export const invoicePassesFilters = (
  invoice: InvoiceSummaryValue,
  filters: ReturnType<typeof billingFilters>,
  today: string,
): boolean => {
  if (filters.status && documentStatus(invoice.status) !== filters.status) return false;
  if (filters.client && invoice.clientId !== filters.client) return false;
  if (filters.from && invoice.dueDate < filters.from) return false;
  if (filters.to && invoice.dueDate > filters.to) return false;
  if (filters.credit === 'with' && invoice.creditedCents === 0) return false;
  if (filters.credit === 'without' && invoice.creditedCents > 0) return false;
  if (filters.due && (invoice.status !== 'issued' || remainingCents(invoice) === 0)) return false;
  if (filters.due === 'overdue' && invoice.dueDate >= today) return false;
  if (filters.due === 'upcoming' && invoice.dueDate < today) return false;
  return true;
};

const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const businessDate = (value: string) => businessDateFormat.format(new Date(value));
export const businessToday = () => businessDateFormat.format(new Date());
