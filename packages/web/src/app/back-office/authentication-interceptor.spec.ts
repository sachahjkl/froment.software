import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { AccessTokenStore } from './access-token-store';
import { authenticationInterceptor } from './authentication-interceptor';

describe('authenticationInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  it('attaches the memory token and retries once after one shared refresh', async () => {
    const http = TestBed.inject(HttpClient);
    const testing = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(AccessTokenStore);
    store.set({ accessToken: 'v4.public.initial', expiresAt: 1, mode: 'administrator' });

    const first = firstValueFrom(http.get('/api/clients'));
    const second = firstValueFrom(http.get('/api/quotes'));
    const firstRequest = testing.expectOne('/api/clients');
    const secondRequest = testing.expectOne('/api/quotes');
    expect(firstRequest.request.headers.get('authorization')).toBe('Bearer v4.public.initial');
    expect(secondRequest.request.headers.get('authorization')).toBe('Bearer v4.public.initial');
    firstRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    secondRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    testing.expectOne('/api/auth/refresh').flush({
      accessToken: 'v4.public.refreshed',
      expiresAt: 2,
      mode: 'administrator',
    });
    const retries = await vi.waitFor(() => {
      const matched = testing.match((request) =>
        ['/api/clients', '/api/quotes'].includes(request.url),
      );
      expect(matched).toHaveLength(2);
      return matched;
    });
    for (const retry of retries) {
      expect(retry.request.headers.get('authorization')).toBe('Bearer v4.public.refreshed');
      retry.flush({});
    }

    await Promise.all([first, second]);
    testing.verify();
  });

  it('does not replace explicit credentials or attach tokens to public routes', () => {
    const http = TestBed.inject(HttpClient);
    const testing = TestBed.inject(HttpTestingController);
    TestBed.inject(AccessTokenStore).set({
      accessToken: 'v4.public.memory',
      expiresAt: 1,
      mode: 'administrator',
    });

    http
      .get('/api/tokens', { headers: { Authorization: 'Bearer froment_api_v1_test' } })
      .subscribe();
    http.post('/api/public/quote-link', {}).subscribe();
    expect(testing.expectOne('/api/tokens').request.headers.get('authorization')).toBe(
      'Bearer froment_api_v1_test',
    );
    expect(testing.expectOne('/api/public/quote-link').request.headers.has('authorization')).toBe(
      false,
    );
  });
});
