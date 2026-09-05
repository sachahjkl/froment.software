import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type InvoiceSummaryValue } from '@froment/contracts';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  it('includes draft invoices in required actions', async () => {
    const invoice = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      orderReference: 'CO-2026-000001',
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      clientDisplayName: 'Acme',
      status: 'draft',
      version: 1,
      invoiceNumber: null,
      title: 'Facture de cadrage',
      dueDate: '2026-09-21',
      currency: 'EUR',
      totalCents: 120_000,
      recordedPaidCents: 0,
      updatedAt: '2026-08-21T10:00:00.000Z',
      pdf: null,
    } satisfies InvoiceSummaryValue;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([invoice]) } },
      ],
    });

    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance['load']();
    fixture.detectChanges();
    const actions = fixture.componentInstance['actions']();

    expect(actions[0]?.label).toMatch(/Facture à finaliser|Invoice to finalize/);
    expect(actions[0]?.title).toBe('Facture de cadrage');
    expect(fixture.componentInstance['activity']()[0]?.link).toEqual([
      '/backoffice/invoices',
      invoice.id,
    ]);
    const root: HTMLElement = fixture.nativeElement;
    const quickActions = root.querySelectorAll<HTMLAnchorElement>('.quick-actions a');
    expect(Array.from(quickActions, ({ href }) => href)).toEqual([
      expect.stringContaining('/backoffice/clients?create=true'),
      expect.stringContaining('/backoffice/quotes/new'),
    ]);
  });

  it('searches clients directly from the dashboard', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ClientsApi,
          useValue: {
            list: () =>
              Promise.resolve([
                { id: 'client-1', displayName: 'Froment Software', email: 'hello@example.test' },
              ]),
          },
        },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance['load']();

    fixture.componentInstance['query'].set('Fromant');

    expect(fixture.componentInstance['searchResults']()).toMatchObject([
      {
        id: 'client-1',
        referenceMatches: [
          [0, 3],
          [5, 6],
        ],
      },
    ]);
  });
});
