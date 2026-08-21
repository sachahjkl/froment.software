import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import {
  type ClientInvoiceListValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
} from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { ClientPortal } from './client-portal';

const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

class ClientPortalApiStub {
  calls = 0;
  fail = false;
  quotes: ClientQuoteListValue = [
    {
      id: quoteId,
      reference: 'DE-2026-000001',
      status: 'accepted',
      title: 'Security audit',
      currency: 'EUR',
      totalCents: 12_000,
      updatedAt: '2026-08-20T08:00:00.000Z',
      pdfAvailable: true,
    },
  ];
  orders: ClientOrderListValue = [
    {
      id: orderId,
      reference: 'CO-2026-000001',
      quoteId,
      quoteReference: 'DE-2026-000001',
      status: 'confirmed',
      title: 'Security audit',
      currency: 'EUR',
      totalCents: 12_000,
      createdAt: '2026-08-20T08:00:00.000Z',
      invoiceId,
      pdfAvailable: true,
    },
  ];
  invoices: ClientInvoiceListValue = [
    {
      id: invoiceId,
      orderId,
      orderReference: 'CO-2026-000001',
      status: 'issued',
      invoiceNumber: 'FA-2026-000001',
      title: 'Security audit',
      dueDate: '2026-09-20',
      currency: 'EUR',
      totalCents: 12_000,
      updatedAt: '2026-08-20T08:00:00.000Z',
      pdfAvailable: false,
    },
  ];

  listQuotes(): Promise<ClientQuoteListValue> {
    this.calls += 1;
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.quotes);
  }

  listOrders(): Promise<ClientOrderListValue> {
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.orders);
  }

  listInvoices(): Promise<ClientInvoiceListValue> {
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.invoices);
  }

  quotePdfUrl(id: string): string {
    return `/api/client/quotes/${id}/pdf`;
  }

  invoicePdfUrl(id: string): string {
    return `/api/client/invoices/${id}/pdf`;
  }

  orderPdfUrl(id: string): string {
    return `/api/client/orders/${id}/pdf`;
  }
}

describe('ClientPortal', () => {
  it('shows document tables and only available PDF links', async () => {
    const api = new ClientPortalApiStub();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientPortalApi, useValue: api },
        { provide: Authentication, useValue: { signOut: () => Promise.resolve(true) } },
      ],
    });
    const fixture = TestBed.createComponent(ClientPortal);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.textContent).toContain('Security audit');
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.textContent).toContain('CO-2026-000001');
    expect(root.textContent).toContain('FA-2026-000001');
    expect(root.querySelector(`a[href="/api/client/quotes/${quoteId}/pdf"]`)).not.toBeNull();
    expect(root.querySelector(`a[href="/api/client/orders/${orderId}/pdf"]`)).not.toBeNull();
    expect(root.querySelector(`a[href="/api/client/invoices/${invoiceId}/pdf"]`)).toBeNull();
  });

  it('shows an error and retries all lists', async () => {
    const api = new ClientPortalApiStub();
    api.fail = true;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientPortalApi, useValue: api },
        { provide: Authentication, useValue: { signOut: () => Promise.resolve(true) } },
      ],
    });
    const fixture = TestBed.createComponent(ClientPortal);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();

    api.fail = false;
    const callsBeforeRetry = api.calls;
    root.querySelector<HTMLButtonElement>('.state button')?.click();
    await fixture.whenStable();

    expect(api.calls).toBe(callsBeforeRetry + 1);
    expect(root.textContent).toContain('Security audit');
  });

  it('focuses the document selected by a portal permalink', async () => {
    const api = new ClientPortalApiStub();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ order: orderId }) } },
        },
        { provide: ClientPortalApi, useValue: api },
        { provide: Authentication, useValue: { signOut: () => Promise.resolve(true) } },
      ],
    });
    const fixture = TestBed.createComponent(ClientPortal);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const row = root.querySelector<HTMLElement>(`#client-order-${orderId}`);

    expect(row?.classList.contains('target-document')).toBe(true);
    expect(row?.tabIndex).toBe(-1);
  });
});
