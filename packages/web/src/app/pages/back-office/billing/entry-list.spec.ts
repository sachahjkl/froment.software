import { convertToParamMap } from '@angular/router';
import {
  compareEntries,
  creditSortColumns,
  entrySort,
  receiptSortColumns,
  refundSortColumns,
  type FinancialEntry,
} from './entry-list';
import { nextBillingSort, sortDirection } from './billing-list';
import { invoiceFixture, paymentFixture } from './billing.spec-helper';

describe('Financial list sort', () => {
  const invoice = invoiceFixture();
  const first: FinancialEntry = {
    ...paymentFixture(),
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.currentRevision.title,
    clientId: invoice.clientId,
    clientDisplayName: 'Équipe 2',
    orderId: invoice.orderId,
    orderReference: invoice.orderReference,
  };
  const second = {
    ...first,
    id: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
    clientDisplayName: 'Equipe 10',
    amountCents: 12000,
    paidOn: '2026-10-01',
  };
  const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
  it('orders cents, business dates and localized text without formatted amount comparisons', () => {
    expect(compareEntries(first, second, 'amount-asc', collator, (key) => key)).toBeLessThan(0);
    expect(compareEntries(first, second, 'amount-desc', collator, (key) => key)).toBeGreaterThan(0);
    expect(compareEntries(first, second, 'date-asc', collator, (key) => key)).toBeLessThan(0);
    expect(compareEntries(first, second, 'client-asc', collator, (key) => key)).toBeLessThan(0);
    const tied = { ...first, id: second.id };
    expect(compareEntries(first, tied, 'amount-desc', collator, (key) => key)).toBeLessThan(0);
  });
  it('accepts only columns present in each table and toggles both URL directions', () => {
    for (const columns of [receiptSortColumns, creditSortColumns, refundSortColumns]) {
      expect(entrySort(convertToParamMap({}), columns)).toBe('date-desc');
      expect(entrySort(convertToParamMap({ sort: 'amount-asc' }), columns)).toBe('amount-asc');
      expect(entrySort(convertToParamMap({ sort: 'actions-desc' }), columns)).toBe('date-desc');
    }
    expect(entrySort(convertToParamMap({ sort: 'status-asc' }), creditSortColumns)).toBe(
      'date-desc',
    );
    expect(nextBillingSort('amount-asc', 'amount')).toBe('amount-desc');
    expect(nextBillingSort('amount-desc', 'amount')).toBe('amount-asc');
    expect(sortDirection('amount-asc', 'amount')).toBe('ascending');
    expect(sortDirection('amount-desc', 'amount')).toBe('descending');
    expect(sortDirection('date-desc', 'amount')).toBe('none');
  });
});
