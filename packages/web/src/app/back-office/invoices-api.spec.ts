import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InvoicesApi } from './invoices-api';

describe('InvoicesApi', () => {
  it('decodes an invoice list', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(InvoicesApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.list();
    http.expectOne('/api/invoices').flush([
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
        orderReference: 'CO-2026-000001',
        clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        clientDisplayName: 'Acme',
        status: 'draft',
        version: 1,
        invoiceNumber: null,
        title: 'Audit',
        dueDate: '2026-09-20',
        currency: 'EUR',
        totalCents: 1_200,
        recordedPaidCents: 0,
        updatedAt: '2026-08-20T06:00:00.000Z',
        pdf: null,
      },
    ]);
    await expect(result).resolves.toHaveLength(1);
    http.verify();
  });

  it('preserves the existing invoice identifier', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(InvoicesApi);
    const http = TestBed.inject(HttpTestingController);
    const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
    const result = api.create({
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      serviceDate: '2026-08-20',
      dueDate: '2026-09-20',
      paymentTerms: '30 days',
    });
    http.expectOne('/api/invoices').flush(
      { _tag: 'InvoiceAlreadyExists', code: 'invoice.already_exists', invoiceId },
      {
        status: 409,
        statusText: 'Conflict',
        headers: new HttpHeaders({ 'x-request-id': 'request-1' }),
      },
    );
    await expect(result).resolves.toMatchObject({
      success: false,
      code: 'invoice.already_exists',
      failure: { invoiceId },
    });
    http.verify();
  });

  it('sends expectedVersion when issuing', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(InvoicesApi);
    const http = TestBed.inject(HttpTestingController);
    const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
    const result = api.issue(invoiceId, 2);
    const request = http.expectOne(`/api/invoices/${invoiceId}/issue`);
    expect(request.request.body).toEqual({ expectedVersion: 2 });
    request.flush({
      invoiceId,
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      version: 3,
      status: 'issued',
      invoiceNumber: 'FA-2026-000001',
      issuedAt: '2026-08-20T06:00:00.000Z',
    });
    await expect(result).resolves.toMatchObject({ success: true, result: { version: 3 } });
    http.verify();
  });
});
