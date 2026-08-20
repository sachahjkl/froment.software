import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClientPortalApi } from './client-portal-api';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('ClientPortalApi', () => {
  it('loads and validates all client document lists', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ClientPortalApi);
    const http = TestBed.inject(HttpTestingController);
    const results = Promise.all([api.listQuotes(), api.listOrders(), api.listInvoices()]);

    http.expectOne('/api/client/quotes').flush([
      {
        id,
        reference: 'DE-2026-000001',
        status: 'sent',
        title: 'Quote',
        currency: 'EUR',
        totalCents: 1_200,
        updatedAt: '2026-08-20T08:00:00.000Z',
        pdfAvailable: true,
      },
    ]);
    http.expectOne('/api/client/orders').flush([]);
    http.expectOne('/api/client/invoices').flush([]);

    await expect(results).resolves.toEqual([expect.any(Array), [], []]);
    http.verify();
  });

  it('builds tenant-scoped PDF endpoint URLs without a client identifier', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ClientPortalApi);

    expect(api.quotePdfUrl(id)).toBe(`/api/client/quotes/${id}/pdf`);
    expect(api.invoicePdfUrl(id)).toBe(`/api/client/invoices/${id}/pdf`);
  });
});
