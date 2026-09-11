import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Authentication } from './authentication';
import { BrowserSessionStore } from './browser-session-store';
import { AUTH_COOKIE_LOCK_MANAGER } from './auth-cookie-lock';
import { authenticationInterceptor } from './authentication-interceptor';

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
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authenticationInterceptor])),
      provideHttpClientTesting(),
      { provide: AUTH_COOKIE_LOCK_MANAGER, useValue: undefined },
    ],
  });
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
    http
      .expectOne('/api/auth/account')
      .flush({ ...administrator, permissions: accountant.permissions });
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

  it('waits for the current revision after a successful cookie refresh', async () => {
    const { auth, http } = setup();
    const account = auth.currentAccount();
    http.expectOne('/api/auth/account').flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
    expect(auth.currentAccount()).toBe(account);
    refresh.flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    const retry = await vi.waitFor(() => http.expectOne('/api/auth/account'));
    retry.flush(administrator);
    await expect(account).resolves.toEqual(administrator);
    TestBed.tick();
    expect(auth.can('client.create')).toBe(true);
    http.verify();
  });

  it.each([401, 403])(
    'stops when the account remains denied with status %s after refresh',
    async (status) => {
      const { auth, http } = setup();
      const account = auth.currentAccount();
      http.expectOne('/api/auth/account').flush({}, { status: 401, statusText: 'Unauthorized' });
      const refresh = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
      TestBed.tick();
      refresh.flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
      const retry = await vi.waitFor(() => http.expectOne('/api/auth/account'));
      TestBed.tick();
      retry.flush({}, { status, statusText: 'Denied' });
      await expect(account).resolves.toBeUndefined();
      TestBed.tick();
      expect(auth.account()).toBeUndefined();
      http.expectNone('/api/auth/account');
      http.expectNone('/api/auth/refresh');
      http.verify();
    },
  );

  it('discards an old response and shares the reload when a timer refresh overtakes it', async () => {
    const { auth, sessions, http } = setup();
    const account = auth.currentAccount();
    const old = http.expectOne('/api/auth/account');
    const refresh = sessions.refresh();
    http
      .expectOne('/api/auth/refresh')
      .flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    await refresh;
    expect(auth.currentAccount()).toBe(account);
    old.flush(administrator);
    const retry = await vi.waitFor(() => http.expectOne('/api/auth/account'));
    retry.flush(accountant);
    await expect(account).resolves.toEqual(accountant);
    http.verify();
  });

  it('does not follow a refresh into a different local identity', async () => {
    const { auth, sessions, http } = setup();
    const old = auth.currentAccount();
    http.expectOne('/api/auth/account').flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
    sessions.clear();
    sessions.set({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    refresh.flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    await expect(old).resolves.toBeUndefined();
    const current = auth.currentAccount();
    http.expectOne('/api/auth/account').flush(accountant);
    await expect(current).resolves.toEqual(accountant);
    http.verify();
  });

  it('rejects a different user returned by a refresh of an established identity', async () => {
    const { auth, http } = setup();
    const initial = auth.currentAccount();
    http.expectOne('/api/auth/account').flush(administrator);
    await initial;
    const refresh = auth.refreshAccount();
    http.expectOne('/api/auth/account').flush(accountant);
    await expect(refresh).resolves.toBeUndefined();
    expect(auth.account()).toBeUndefined();
    http.verify();
  });
});
