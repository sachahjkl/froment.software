import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type InvoiceSummaryValue } from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
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
      updatedAt: '2026-08-21T10:00:00.000Z',
      pdf: null,
    } satisfies InvoiceSummaryValue;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Authentication, useValue: { signOut: () => Promise.resolve(true) } },
        { provide: QuotesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([invoice]) } },
      ],
    });

    const fixture = TestBed.createComponent(Dashboard);
    await fixture.componentInstance['load']();
    const actions = fixture.componentInstance['actions']();

    expect(actions[0]?.label).toMatch(/Facture à finaliser|Invoice to finalize/);
    expect(actions[0]?.title).toBe('Facture de cadrage');
  });
});
