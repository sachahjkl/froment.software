import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import {
  type InvoiceSummaryValue,
  type QuoteSummaryValue,
  type OrderSummaryValue,
} from '@froment/contracts';
import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { Dashboard } from './dashboard';

const invoice: InvoiceSummaryValue = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  orderReference: 'CO-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  clientDisplayName: 'Acme',
  status: 'draft',
  version: 1,
  invoiceNumber: null,
  title: 'Facture de cadrage',
  dueDate: '2020-01-01',
  currency: 'EUR',
  totalCents: 120000,
  recordedPaidCents: 0,
  creditedCents: 0,
  updatedAt: '2026-08-21T10:00:00.000Z',
  pdf: null,
};
const quote: QuoteSummaryValue = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  clientId: invoice.clientId,
  clientDisplayName: 'Acme',
  reference: 'DE-2026-000001',
  title: 'Devis Acme',
  status: 'sent',
  version: 1,
  currency: 'EUR',
  totalCents: 120000,
  updatedAt: '2026-08-20T10:00:00.000Z',
};

async function configure(
  invoices: readonly InvoiceSummaryValue[],
  quotes: readonly QuoteSummaryValue[] = [],
  orders: readonly OrderSummaryValue[] = [],
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'dashboard', component: Dashboard }]),
      { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
      { provide: QuotesApi, useValue: { list: () => Promise.resolve(quotes) } },
      { provide: OrdersApi, useValue: { list: () => Promise.resolve(orders) } },
      { provide: InvoicesApi, useValue: { list: () => Promise.resolve(invoices) } },
    ],
  });
  const harness = await RouterTestingHarness.create('/dashboard');
  await harness.fixture.whenStable();
  return { harness, root: harness.routeNativeElement! };
}

describe('Dashboard', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('links draft invoices directly to their editor and metrics to filtered workspaces', async () => {
    const startedAt = Date.now();
    const { root } = await configure([invoice]);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      `/backoffice/invoices/${invoice.id}/edit`,
    );
    expect(root.querySelectorAll('.metrics a')).toHaveLength(5);
    const timestamp = root.querySelector('#dashboard-loaded-at time')?.getAttribute('datetime');
    expect(timestamp).toBeDefined();
    expect(Date.parse(timestamp!)).toBeGreaterThanOrEqual(startedAt);
    expect(Date.parse(timestamp!)).toBeLessThanOrEqual(Date.now());
    for (const metric of root.querySelectorAll('.metrics a'))
      expect(metric.getAttribute('aria-describedby')).toBe('dashboard-loaded-at');
    expect(root.querySelector('.metrics a')?.getAttribute('href')).toBe(
      '/backoffice/affaires/attention?stage=draft',
    );
    expect(root.querySelector('search')).toBeNull();
    expect(root.querySelector('.activity-list time')?.getAttribute('datetime')).toBe(
      invoice.updatedAt,
    );
  });

  it('counts partially credited overdue balances and excludes settled invoices', async () => {
    const overdue = {
      ...invoice,
      status: 'issued' as const,
      creditedCents: 20000,
      recordedPaidCents: 30000,
    };
    const paid = {
      ...invoice,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
      status: 'issued' as const,
      recordedPaidCents: 120000,
    };
    const { root } = await configure([overdue, paid], [quote]);
    const amounts = root.querySelectorAll('.metrics strong');
    expect(amounts[3]?.textContent).toMatch(/700[,.]00/);
    expect(amounts[4]?.textContent).toBe('1');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      `/backoffice/invoices/${invoice.id}`,
    );
    expect(root.querySelectorAll('tbody [appBadge]')[1]?.textContent).toMatch(
      /Attente normale|Normal waiting/,
    );
    expect(root.querySelectorAll('tbody [appBadge]')[1]?.classList.contains('warn')).toBe(false);
  });

  it('opens an eligible reminder draft without sending a message', async () => {
    const { root } = await configure([{ ...invoice, status: 'issued' }]);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      `/backoffice/courriels/new?invoice=${invoice.id}`,
    );
  });

  it.each(['draft', 'issued'] as const)(
    'opens the document first when its PDF failed (%s)',
    async (status) => {
      const { root } = await configure([
        { ...invoice, status, pdf: { status: 'failed', attempts: 1, error: 'pdf.render_failed' } },
      ]);
      expect(root.querySelector('tbody [appBadge]')?.textContent).toMatch(
        /Blocage : PDF en échec|Blocked: PDF failed/,
      );
      expect(root.querySelector('tbody a')?.textContent).toMatch(
        /Consulter la facture|View invoice/,
      );
      expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
        `/backoffice/invoices/${invoice.id}`,
      );
    },
  );

  it('uses the orderId query contract when creating an invoice', async () => {
    const order: OrderSummaryValue = {
      id: invoice.orderId,
      reference: invoice.orderReference,
      quoteId: quote.id,
      quoteReference: quote.reference,
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      clientId: invoice.clientId,
      clientDisplayName: invoice.clientDisplayName,
      title: invoice.title,
      currency: 'EUR',
      totalCents: invoice.totalCents,
      createdAt: invoice.updatedAt,
      invoiceId: null,
      pdfAvailable: false,
    };
    const { root } = await configure([], [], [order]);
    expect(root.querySelector('tbody a')?.getAttribute('href')).toBe(
      `/backoffice/invoices/new?orderId=${order.id}`,
    );
  });
});
