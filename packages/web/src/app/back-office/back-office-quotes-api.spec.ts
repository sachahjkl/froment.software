import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BackOfficeQuotesApi } from './back-office-quotes-api';

describe('BackOfficeQuotesApi', () => {
  it('validates the quote list response', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(BackOfficeQuotesApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.list();
    http.expectOne('/api/quotes').flush([
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
        clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
        status: 'draft',
        version: 1,
        clientDisplayName: 'Acme',
        title: 'Audit',
        currency: 'EUR',
        totalCents: 1_200,
        updatedAt: '2026-08-19T20:00:00.000Z',
      },
    ]);

    await expect(result).resolves.toHaveLength(1);
    http.verify();
  });

  it('decodes a version conflict', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(BackOfficeQuotesApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.createRevision('01ARZ3NDEKTSV4RRFFQ69G5FAY', {
      expectedVersion: 1,
      title: 'Audit',
      conditions: '',
      lines: [
        {
          description: 'Audit',
          quantityMilli: 1_000,
          unitPriceCents: 1_000,
          vatRateBasisPoints: 2_000,
        },
      ],
    });
    http.expectOne('/api/quotes/01ARZ3NDEKTSV4RRFFQ69G5FAY/revisions').flush(
      { _tag: 'QuoteVersionConflict', code: 'quote.version_conflict', currentVersion: 2 },
      {
        status: 409,
        statusText: 'Conflict',
        headers: new HttpHeaders({ 'x-request-id': '0198c423-f7a0-7000-8000-000000000001' }),
      },
    );

    const outcome = await result;
    expect(outcome).toMatchObject({
      success: false,
      code: 'quote.version_conflict',
      status: 409,
      requestId: '0198c423-f7a0-7000-8000-000000000001',
      failure: {
        _tag: 'QuoteVersionConflict',
        code: 'quote.version_conflict',
        currentVersion: 2,
      },
    });
    expect(outcome.success || outcome.cause).toBeInstanceOf(HttpErrorResponse);
    http.verify();
  });

  it('preserves an undeclared server error for diagnostics', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(BackOfficeQuotesApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.get('01ARZ3NDEKTSV4RRFFQ69G5FAY');
    const serverError = { code: 'server.failure', requestId: 'request-1' };
    http
      .expectOne('/api/quotes/01ARZ3NDEKTSV4RRFFQ69G5FAY')
      .flush(serverError, { status: 500, statusText: 'Internal Server Error' });

    const outcome = await result;
    expect(outcome).toMatchObject({
      success: false,
      code: 'quote.error',
      status: 500,
      serverError,
    });
    expect(outcome.success || outcome.cause).toBeInstanceOf(HttpErrorResponse);
    http.verify();
  });

  it('sends the expected quote version and validates the permalink', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(BackOfficeQuotesApi);
    const http = TestBed.inject(HttpTestingController);
    const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
    const result = api.send(quoteId, { expectedVersion: 2 });
    const request = http.expectOne(`/api/quotes/${quoteId}/send`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ expectedVersion: 2 });
    request.flush({
      quoteId,
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      status: 'sent',
      version: 2,
      link: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        url: 'https://froment.software/api/public/quote-links/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/pdf',
        expiresAt: '2026-09-19T20:00:00.000Z',
      },
    });

    await expect(result).resolves.toMatchObject({
      success: true,
      result: { quoteId, status: 'sent', version: 2 },
    });
    http.verify();
  });

  it('decodes the required PDF error when sending', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(BackOfficeQuotesApi);
    const http = TestBed.inject(HttpTestingController);
    const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
    const result = api.send(quoteId, { expectedVersion: 2 });
    http
      .expectOne(`/api/quotes/${quoteId}/send`)
      .flush(
        { _tag: 'QuotePdfRequired', code: 'quote.pdf_required' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(result).resolves.toMatchObject({
      success: false,
      code: 'quote.pdf_required',
      failure: { _tag: 'QuotePdfRequired' },
    });
    http.verify();
  });
});
