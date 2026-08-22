import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IntegrationTokensApi } from './integration-tokens-api';

describe('IntegrationTokensApi', () => {
  it('validates responses and sends CSRF tokens on writes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withXsrfConfiguration({
            cookieName: '__Host-froment-csrf',
            headerName: 'X-CSRF-Token',
          }),
        ),
        provideHttpClientTesting(),
        {
          provide: DOCUMENT,
          useValue: {
            cookie: '__Host-froment-csrf=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
        },
      ],
    });
    const api = TestBed.inject(IntegrationTokensApi);
    const http = TestBed.inject(HttpTestingController);
    const token = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'ERP',
      permissions: ['client.read'],
      createdAt: 1_700_000_000_000,
      expiresAt: 1_800_000_000_000,
      lastUsedAt: null,
      revokedAt: null,
      rateLimitPerMinute: 120,
    };
    const secret = `froment_it_v1_${token.id}.${'a'.repeat(43)}`;

    const list = api.list();
    http.expectOne('/api/integration-tokens').flush([token]);
    await expect(list).resolves.toEqual([token]);

    const payload = {
      name: 'ERP',
      permissions: ['client.read'] as const,
      expiresAt: 1_800_000_000_000,
    };
    const create = api.create(payload);
    const createRequest = http.expectOne('/api/integration-tokens');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.headers.get('x-csrf-token')).toBe(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(createRequest.request.body).toEqual(payload);
    createRequest.flush({ token, secret });
    await expect(create).resolves.toEqual({ success: true, result: { token, secret } });

    const revoke = api.revoke(token.id);
    const revokeRequest = http.expectOne(`/api/integration-tokens/${token.id}/revoke`);
    expect(revokeRequest.request.method).toBe('POST');
    expect(revokeRequest.request.headers.get('x-csrf-token')).toBe(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    revokeRequest.flush({ ...token, revokedAt: 1_750_000_000_000 });
    await expect(revoke).resolves.toMatchObject({ success: true });

    http.verify();
  });

  it('rejects an invalid list response', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(IntegrationTokensApi);
    const http = TestBed.inject(HttpTestingController);

    const list = api.list();
    http.expectOne('/api/integration-tokens').flush([{ id: 'invalid' }]);
    await expect(list).rejects.toThrow();
    http.verify();
  });
});
