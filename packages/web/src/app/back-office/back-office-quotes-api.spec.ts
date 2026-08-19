import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BackOfficeQuotesApi } from './back-office-quotes-api';

const revision = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  version: 1,
  clientDisplayName: 'Acme',
  title: 'Audit',
  conditions: '',
  currency: 'EUR',
  netTotalCents: 1_000,
  vatTotalCents: 200,
  totalCents: 1_200,
  createdAt: '2026-08-19T20:00:00.000Z',
  createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      position: 0,
      description: 'Audit',
      quantityMilli: 1_000,
      unitPriceCents: 1_000,
      vatRateBasisPoints: 2_000,
      netTotalCents: 1_000,
      vatTotalCents: 200,
      totalCents: 1_200,
    },
  ],
};

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
        currentRevision: revision,
        revisions: [revision],
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

    await expect(result).resolves.toEqual({ success: false, code: 'quote.version_conflict' });
    http.verify();
  });
});
