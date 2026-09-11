import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Authentication } from './authentication';
import { BrowserSessionStore } from './browser-session-store';

const administrator = {
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  email: 'admin@example.test',
  mode: 'administrator',
  permissions: ['client.read', 'client.create'],
};
const accountant = {
  ...administrator,
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  permissions: ['client.read'],
};

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const auth = TestBed.inject(Authentication);
  const sessions = TestBed.inject(BrowserSessionStore);
  sessions.set({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
  return { auth, sessions, http: TestBed.inject(HttpTestingController) };
};

describe('effective account permissions', () => {
  it('denies unknown accounts and shares one account request per session', async () => {
    const { auth, http } = setup();
    expect(auth.can('client.create')).toBe(false);
    const first = auth.currentAccount();
    const second = auth.currentAccount();
    expect(first).toBe(second);
    http.expectOne('/api/auth/account').flush(accountant);
    await first;
    expect(auth.can('client.read')).toBe(true);
    expect(auth.can('client.create')).toBe(false);
    await auth.currentAccount();
    http.expectNone('/api/auth/account');
    http.verify();
  });

  it('invalidates cached permissions and ignores a response from a previous account', async () => {
    const { auth, sessions, http } = setup();
    const old = auth.currentAccount();
    const oldRequest = http.expectOne('/api/auth/account');
    sessions.set({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    const current = auth.currentAccount();
    http.expectOne('/api/auth/account').flush(accountant);
    await current;
    oldRequest.flush(administrator);
    await expect(old).resolves.toBeUndefined();
    expect(auth.account()?.userId).toBe(accountant.userId);
    expect(auth.can('client.create')).toBe(false);
    sessions.clear();
    expect(auth.account()).toBeUndefined();
    await expect(auth.currentAccount()).resolves.toBeUndefined();
    http.verify();
  });

  it('removes permissions during refresh and loads effective permissions again afterwards', async () => {
    const { auth, sessions, http } = setup();
    const initial = auth.currentAccount();
    http.expectOne('/api/auth/account').flush(administrator);
    await initial;
    expect(auth.can('client.create')).toBe(true);
    const refresh = sessions.refresh();
    expect(auth.can('client.create')).toBe(false);
    const account = auth.currentAccount();
    http.expectNone('/api/auth/account');
    http
      .expectOne('/api/auth/refresh')
      .flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    await refresh;
    http.expectOne('/api/auth/account').flush(accountant);
    await account;
    expect(auth.can('client.read')).toBe(true);
    expect(auth.can('client.create')).toBe(false);
    http.verify();
  });

  it('fails closed on explicit account reload errors and missing permission fields', async () => {
    const { auth, http } = setup();
    const initial = auth.currentAccount();
    http.expectOne('/api/auth/account').flush(administrator);
    await initial;
    const reload = auth.refreshAccount();
    expect(auth.can('client.create')).toBe(false);
    http.expectOne('/api/auth/account').flush({}, { status: 503, statusText: 'Unavailable' });
    await expect(reload).resolves.toBeUndefined();
    const retry = auth.currentAccount();
    http.expectOne('/api/auth/account').flush({
      userId: administrator.userId,
      email: administrator.email,
      mode: administrator.mode,
    });
    await expect(retry).resolves.toBeUndefined();
    expect(auth.can('client.create')).toBe(false);
    http.verify();
  });
});
