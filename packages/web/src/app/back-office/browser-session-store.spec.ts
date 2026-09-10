import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AUTH_COOKIE_LOCK_MANAGER } from './auth-cookie-lock';
import { Authentication } from './authentication';
import { BrowserSessionStore } from './browser-session-store';

describe('BrowserSessionStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_COOKIE_LOCK_MANAGER, useValue: undefined },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
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

  it('does not restore a session cleared while the decoder loads', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const refresh = store.refresh();
    http.expectOne('/api/auth/refresh').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await Promise.resolve();
    expect(store.mode()).toBeUndefined();
    store.clear();

    await expect(refresh).resolves.toBeUndefined();
    expect(store.mode()).toBeUndefined();
  });

  it('shares the pending refresh while the decoder loads and preserves newer state', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const refresh = store.refresh();
    http.expectOne('/api/auth/refresh').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await Promise.resolve();
    expect(store.refresh()).toBe(refresh);
    expect(store.mode()).toBeUndefined();
    store.set({ expiresAt: Date.now() + 600_000, mode: 'client' });
    http.expectNone('/api/auth/refresh');

    await expect(refresh).resolves.toBe('client');
    expect(store.mode()).toBe('client');
  });

  it('does not restore a session when logout starts while the decoder loads', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);
    store.set({ expiresAt: Date.now() + 600_000, mode: 'administrator' });
    const refresh = store.refresh();
    http.expectOne('/api/auth/refresh').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    await Promise.resolve();
    const logout = auth.signOut();
    http.expectOne('/api/auth/logout').flush(null);

    await expect(refresh).resolves.toBeUndefined();
    await expect(logout).resolves.toBe(true);
    expect(store.mode()).toBeUndefined();
  });

  it('clears an invalid refresh response without reporting the cached session mode', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    store.set({ expiresAt: Date.now() + 600_000, mode: 'administrator' });
    const refresh = store.refresh();
    http.expectOne('/api/auth/refresh').flush({ mode: 'administrator' });

    await expect(refresh).resolves.toBeUndefined();
    expect(store.mode()).toBeUndefined();

    const retry = store.refresh();
    expect(retry).not.toBe(refresh);
    http.expectOne('/api/auth/refresh').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    await expect(retry).resolves.toBe('client');
    expect(store.mode()).toBe('client');
  });

  it('preserves newer state when a pending refresh response is invalid', async () => {
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    const refresh = store.refresh();
    http.expectOne('/api/auth/refresh').flush({ mode: 'administrator' });

    await Promise.resolve();
    store.set({ expiresAt: Date.now() + 600_000, mode: 'client' });

    await expect(refresh).resolves.toBe('client');
    expect(store.mode()).toBe('client');
  });

  it('refreshes an expiring session when the window regains focus', async () => {
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
      await expect(store.refresh()).resolves.toBe('administrator');
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });
});
