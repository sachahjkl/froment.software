import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PublicQuoteApi } from './public-quote-api';

const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('PublicQuoteApi', () => {
  it('loads a public quote without placing the token in the URL', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(PublicQuoteApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.get(token);
    const request = http.expectOne('/api/public/quote-link');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ token });
    request.flush({
      status: 'sent',
      canSign: true,
      expiresAt: '2026-09-19T06:00:00.000Z',
      snapshot: {
        templateId: 'quote-default',
        templateVersion: 1,
        quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        version: 1,
        createdAt: '2026-08-20T06:00:00.000Z',
        issuer: {
          displayName: 'Froment Software',
          addressLine1: '',
          addressLine2: '',
          postalCode: '',
          city: '',
          country: '',
          email: '',
          phone: '',
          registrationNumber: '',
          vatNumber: '',
        },
        client: {
          displayName: 'Client',
          addressLine1: '',
          addressLine2: '',
          postalCode: '',
          city: '',
          country: '',
          email: '',
        },
        title: 'Audit',
        conditions: '',
        currency: 'EUR',
        netTotalCents: 100,
        vatTotalCents: 20,
        totalCents: 120,
        lines: [],
      },
    });

    await expect(result).resolves.toMatchObject({
      success: true,
      result: { status: 'sent', canSign: true, snapshot: { title: 'Audit' } },
    });
    http.verify();
  });
});
