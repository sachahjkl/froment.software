import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, convertToParamMap } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type InvoiceSummaryValue } from '@froment/contracts';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Billing } from './billing';
import {
  billingFilters,
  billingSort,
  compareInvoices,
  businessDate,
  documentStatus,
  financialStatus,
  invoicePassesFilters,
  invoiceSortColumns,
  type InvoiceSort,
  reminderEligible,
} from './billing-state';
import { nextBillingSort, sortDirection } from './billing-list';

const invoice = (
  id: string,
  status: InvoiceSummaryValue['status'] = 'issued',
): InvoiceSummaryValue => ({
  id,
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  orderReference: 'CO-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  clientDisplayName: 'Acme',
  status,
  version: 2,
  invoiceNumber: 'FA-2026-000001',
  title: 'Audit',
  dueDate: '2026-08-21',
  currency: 'EUR',
  totalCents: 1200,
  recordedPaidCents: status === 'paid' ? 1200 : 0,
  creditedCents: 0,
  updatedAt: '2026-08-21T10:00:00.000Z',
  pdf: { status: 'ready', attempts: 1, error: null },
});

describe('Billing', () => {
  it('sorts deterministically and accepts only known URL sort values', () => {
    const first = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    const second = { ...first, id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ', totalCents: 2400 };
    expect(billingSort(convertToParamMap({ sort: 'total-desc' }))).toBe('total-desc');
    expect(billingSort(convertToParamMap({ sort: 'unknown' }))).toBe('none');
    expect(billingSort(convertToParamMap({}))).toBe('none');
    expect(billingSort(convertToParamMap({ sort: 'none' }))).toBe('none');
    const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
    const compare = (left: InvoiceSummaryValue, right: InvoiceSummaryValue, sort: InvoiceSort) =>
      compareInvoices(left, right, sort, collator, (key) => key);
    expect(compare(first, second, 'total-desc')).toBeGreaterThan(0);
    expect(compare(first, second, 'total-asc')).toBeLessThan(0);
    expect(compare(first, second, 'due-asc')).toBeLessThan(0);
    expect(compare(first, { ...second, dueDate: '2026-08-01' }, 'due-asc')).toBeGreaterThan(0);
    expect(
      compare(first, { ...second, invoiceNumber: 'FA-2026-000002' }, 'number-asc'),
    ).toBeLessThan(0);
  });
  it.each(invoiceSortColumns)(
    'cycles %s through ascending, descending and the initial order',
    (column) => {
      const ascending = nextBillingSort('none', column);
      const descending = nextBillingSort(ascending, column);
      const reset = nextBillingSort(descending, column);
      expect(ascending).toBe(`${column}-asc`);
      expect(descending).toBe(`${column}-desc`);
      expect(reset).toBe('none');
      expect(nextBillingSort(reset, column)).toBe(ascending);
      expect(nextBillingSort(column === 'due' ? 'total-desc' : 'due-desc', column)).toBe(ascending);
      expect(billingSort(convertToParamMap({ sort: ascending }))).toBe(ascending);
      expect(billingSort(convertToParamMap({ sort: descending }))).toBe(descending);
      expect(invoiceSortColumns.every((key) => sortDirection(reset, key) === 'none')).toBe(true);
    },
  );
  it('restores due-asc and its ID tie-break without changing the source invoices', () => {
    const first = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    const second = { ...first, id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ' };
    const earlier = { ...first, dueDate: '2026-08-01' };
    const rows = Object.freeze([second, first, earlier]);
    const reset = nextBillingSort('total-desc', 'total');
    const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
    const sorted = rows.toSorted((left, right) =>
      compareInvoices(left, right, reset, collator, (key) => key),
    );
    expect(sorted).toEqual([earlier, first, second]);
    expect(sorted).toEqual(
      rows.toSorted((left, right) =>
        compareInvoices(left, right, 'due-asc', collator, (key) => key),
      ),
    );
    expect(rows).toEqual([second, first, earlier]);
  });
  it('separates document status from its financial state', () => {
    const paid = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY', 'paid');
    expect(documentStatus(paid.status)).toBe('issued');
    expect(financialStatus(paid)).toBe('billingWorkspace.paid');
    expect(financialStatus({ ...paid, status: 'issued', recordedPaidCents: 400 })).toBe(
      'billingWorkspace.partial',
    );
    expect(financialStatus({ ...paid, creditedCents: 1200 })).toBe('billingWorkspace.credited');
    expect(financialStatus({ ...paid, status: 'draft' })).toBe('billingWorkspace.notApplicable');
  });
  it('applies document, due date, credit and client filters independently of search', () => {
    const item = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    for (const query of ['fa-2026', 'Audit', 'ACME', 'CO-2026']) {
      expect(
        invoicePassesFilters(
          item,
          billingFilters(
            convertToParamMap({ q: query, status: 'issued', due: 'overdue', credit: 'without' }),
          ),
          '2026-09-01',
        ),
      ).toBe(true);
    }
    expect(
      invoicePassesFilters(
        item,
        billingFilters(convertToParamMap({ client: 'other' })),
        '2026-09-01',
      ),
    ).toBe(false);
  });
  it('selects reminders only for overdue issued invoices with a positive uncredited balance', () => {
    const item = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    expect(reminderEligible(item, '2026-09-01')).toBe(true);
    expect(reminderEligible({ ...item, status: 'paid' }, '2026-09-01')).toBe(false);
    expect(reminderEligible({ ...item, creditedCents: 1200 }, '2026-09-01')).toBe(false);
    expect(reminderEligible({ ...item, recordedPaidCents: 1200 }, '2026-09-01')).toBe(false);
    expect(reminderEligible({ ...item, dueDate: '2026-10-01' }, '2026-09-01')).toBe(false);
    expect(businessDate('2026-09-09T23:30:00.000Z')).toBe('2026-09-10');
  });
  it('uses inclusive due date bounds and ignores invalid calendar dates in the URL', () => {
    const item = invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    for (const params of [
      { from: '2026-08-21' },
      { to: '2026-08-21' },
      { from: '2026-08-21', to: '2026-08-21' },
    ]) {
      expect(
        invoicePassesFilters(item, billingFilters(convertToParamMap(params)), '2026-09-01'),
      ).toBe(true);
    }
    for (const params of [
      { from: '2026-08-22' },
      { to: '2026-08-20' },
      { from: '2026-08-22', to: '2026-08-20' },
    ]) {
      expect(
        invoicePassesFilters(item, billingFilters(convertToParamMap(params)), '2026-09-01'),
      ).toBe(false);
    }
    expect(
      billingFilters(convertToParamMap({ from: '2026-02-30', to: 'not-a-date' })),
    ).toMatchObject({ from: '', to: '' });
  });
  it('restores filters from the URL and links the first data column to the detail', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([{ path: 'backoffice/facturation', component: Billing }]),
        {
          provide: InvoicesApi,
          useValue: { list: async () => [invoice('01ARZ3NDEKTSV4RRFFQ69G5FAY')] },
        },
      ],
    });
    const harness = await RouterTestingHarness.create(
      '/backoffice/facturation?q=Acme&status=issued',
    );
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('Acme');
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      '/backoffice/invoices/01ARZ3NDEKTSV4RRFFQ69G5FAY',
    );
    expect(root.querySelector('.payment-export')).toBeNull();
    expect(root.querySelector('tbody button')).toBeNull();
  });
});
