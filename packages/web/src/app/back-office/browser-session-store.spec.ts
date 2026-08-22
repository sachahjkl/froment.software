import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BrowserSessionStore } from './browser-session-store';

describe('BrowserSessionStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('expires session mode state using expiresAt', () => {
    const store = TestBed.inject(BrowserSessionStore);
    store.set({
      expiresAt: Date.now() - 1,
      mode: 'administrator',
    });

    expect(store.mode()).toBeUndefined();
  });

  it('does not restore a refresh response after clear', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const refresh = store.refresh();

    const request = http.expectOne('/api/auth/refresh');
    store.clear();
    request.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await expect(refresh).resolves.toBeUndefined();
    expect(store.mode()).toBeUndefined();
    http.verify();
  });

  it('does not let a pending refresh overwrite newer state', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const first = store.refresh();
    const second = store.refresh();

    expect(first).toBe(second);
    const request = http.expectOne('/api/auth/refresh');
    store.set({
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    request.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await expect(first).resolves.toBe('client');
    expect(store.mode()).toBe('client');
    http.verify();
  });

  it('refreshes an expiring session when the window regains focus', () => {
    vi.useFakeTimers();
    try {
      const now = Date.now();
      const store = TestBed.inject(BrowserSessionStore);
      const http = TestBed.inject(HttpTestingController);
      store.set({ expiresAt: now + 600_000, mode: 'administrator' });
      vi.setSystemTime(now + 580_000);

      window.dispatchEvent(new Event('focus'));

      http.expectOne('/api/auth/refresh').flush({
        expiresAt: now + 1_180_000,
        mode: 'administrator',
      });
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });
});
