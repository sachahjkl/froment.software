import { type ParamMap } from '@angular/router';
import {
  type InvoiceReceiptList,
  type CreditNoteList,
  type InvoiceRefundList,
} from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { paymentMethodKey } from './billing-state';
import { type BillingSort, readBillingSort } from './billing-list';

export const receiptSortColumns = [
  'reference',
  'invoice',
  'client',
  'date',
  'method',
  'status',
  'amount',
] as const;
export const creditSortColumns = ['reference', 'invoice', 'client', 'date', 'amount'] as const;
export const refundSortColumns = [
  'reference',
  'invoice',
  'client',
  'date',
  'status',
  'amount',
] as const;
export type EntrySortColumn = (typeof receiptSortColumns)[number];
export type EntrySort = BillingSort<EntrySortColumn>;
export type FinancialEntry =
  | (typeof InvoiceReceiptList.Type)[number]
  | (typeof CreditNoteList.Type)[number]
  | (typeof InvoiceRefundList.Type)[number];

export const entrySort = (params: ParamMap, columns: readonly EntrySortColumn[]): EntrySort =>
  readBillingSort<EntrySortColumn>(params, columns);

export function compareEntries(
  left: FinancialEntry,
  right: FinancialEntry,
  sort: EntrySort,
  collator: Intl.Collator,
  translate: (key: TranslationKey) => string,
): number {
  const order = sort === 'none' ? 'date-desc' : sort;
  let comparison: number;
  if (order.startsWith('amount-')) {
    const amount = (entry: FinancialEntry): number =>
      'amountCents' in entry ? entry.amountCents : entry.totalCents;
    comparison = amount(left) - amount(right);
  } else if (order.startsWith('date-')) {
    const date = (entry: FinancialEntry): number =>
      Date.parse(
        'paidOn' in entry
          ? entry.paidOn
          : 'refundedOn' in entry
            ? entry.refundedOn
            : entry.issuedAt,
      );
    comparison = date(left) - date(right);
  } else {
    const value = (entry: FinancialEntry): string => {
      if (order.startsWith('invoice-')) return entry.invoiceNumber ?? entry.title;
      if (order.startsWith('client-')) return entry.clientDisplayName;
      if (order.startsWith('method-'))
        return 'method' in entry ? translate(paymentMethodKey(entry.method)) : '';
      if (order.startsWith('status-'))
        return translate(
          'cancelledAt' in entry && entry.cancelledAt !== null
            ? 'billingWorkspace.cancelled'
            : 'billingWorkspace.active',
        );
      return 'reference' in entry ? entry.reference : entry.number;
    };
    comparison = collator.compare(value(left), value(right));
  }
  return (order.endsWith('-desc') ? -comparison : comparison) || left.id.localeCompare(right.id);
}
