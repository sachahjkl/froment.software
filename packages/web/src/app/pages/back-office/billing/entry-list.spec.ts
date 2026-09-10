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
  it('accepts only columns present in each table', () => {
    for (const columns of [receiptSortColumns, creditSortColumns, refundSortColumns]) {
      expect(entrySort(convertToParamMap({}), columns)).toBe('none');
      expect(entrySort(convertToParamMap({ sort: 'none' }), columns)).toBe('none');
      expect(entrySort(convertToParamMap({ sort: 'amount-asc' }), columns)).toBe('amount-asc');
      expect(entrySort(convertToParamMap({ sort: 'actions-desc' }), columns)).toBe('none');
    }
    expect(entrySort(convertToParamMap({ sort: 'status-asc' }), creditSortColumns)).toBe('none');
    expect(sortDirection('amount-asc', 'amount')).toBe('ascending');
    expect(sortDirection('amount-desc', 'amount')).toBe('descending');
    expect(sortDirection('date-desc', 'amount')).toBe('none');
  });
  it.each(receiptSortColumns)(
    'cycles %s through ascending, descending and the initial order',
    (column) => {
      const ascending = nextBillingSort('none', column);
      const descending = nextBillingSort(ascending, column);
      const reset = nextBillingSort(descending, column);
      expect(ascending).toBe(`${column}-asc`);
      expect(descending).toBe(`${column}-desc`);
      expect(reset).toBe('none');
      expect(nextBillingSort(reset, column)).toBe(ascending);
      expect(nextBillingSort(column === 'date' ? 'amount-desc' : 'date-desc', column)).toBe(
        ascending,
      );
      expect(receiptSortColumns.every((key) => sortDirection(reset, key) === 'none')).toBe(true);
    },
  );
  it('restores date-desc and its ID tie-break without changing the source entries', () => {
    const tied = { ...first, id: second.id };
    const rows = Object.freeze([tied, first, second]);
    const reset = nextBillingSort('amount-desc', 'amount');
    const sorted = rows.toSorted((left, right) =>
      compareEntries(left, right, reset, collator, (key) => key),
    );
    expect(sorted).toEqual([second, first, tied]);
    expect(sorted).toEqual(
      rows.toSorted((left, right) =>
        compareEntries(left, right, 'date-desc', collator, (key) => key),
      ),
    );
    expect(rows).toEqual([tied, first, second]);
  });
});
