import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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
    http
      .expectOne('/api/quotes/01ARZ3NDEKTSV4RRFFQ69G5FAY/revisions')
      .flush(
        { _tag: 'QuoteVersionConflict', code: 'quote.version_conflict', currentVersion: 2 },
        { status: 409, statusText: 'Conflict' },
      );

    const outcome = await result;
    expect(outcome).toMatchObject({
      success: false,
      code: 'quote.version_conflict',
      status: 409,
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
});
