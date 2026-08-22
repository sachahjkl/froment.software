import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AccessTokenStore } from './access-token-store';

describe('AccessTokenStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('expires token and mode state using expiresAt', () => {
    const store = TestBed.inject(AccessTokenStore);
    store.set({
      accessToken: 'v4.public.expired',
      expiresAt: Date.now() - 1,
      mode: 'administrator',
    });

    expect(store.token()).toBeUndefined();
    expect(store.mode()).toBeUndefined();
  });

  it('does not restore a refresh response after clear', async () => {
    const store = TestBed.inject(AccessTokenStore);
    const http = TestBed.inject(HttpTestingController);
    const refresh = store.refresh();

    const request = http.expectOne('/api/auth/refresh');
    store.clear();
    request.flush({
      accessToken: 'v4.public.stale',
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await expect(refresh).resolves.toBeUndefined();
    expect(store.token()).toBeUndefined();
    expect(store.mode()).toBeUndefined();
    http.verify();
  });

  it('does not let a pending refresh overwrite newer state', async () => {
    const store = TestBed.inject(AccessTokenStore);
    const http = TestBed.inject(HttpTestingController);
    const first = store.refresh();
    const second = store.refresh();

    expect(first).toBe(second);
    const request = http.expectOne('/api/auth/refresh');
    store.set({
      accessToken: 'v4.public.newer',
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    request.flush({
      accessToken: 'v4.public.stale',
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await expect(first).resolves.toBe('client');
    expect(store.token()).toBe('v4.public.newer');
    expect(store.mode()).toBe('client');
    http.verify();
  });
});
