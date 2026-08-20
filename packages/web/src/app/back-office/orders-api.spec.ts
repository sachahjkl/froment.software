import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OrdersApi } from './orders-api';

describe('OrdersApi', () => {
  it('decodes confirmed orders', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(OrdersApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.list();
    http.expectOne('/api/orders').flush([
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        reference: 'CO-2026-000001',
        quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
        quoteReference: 'DE-2026-000001',
        revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        clientDisplayName: 'Acme',
        title: 'Audit',
        currency: 'EUR',
        totalCents: 1_200,
        createdAt: '2026-08-20T06:00:00.000Z',
        invoiceId: null,
      },
    ]);
    await expect(result).resolves.toHaveLength(1);
    http.verify();
  });
});
