import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';

import { BrowserSessionStore } from './browser-session-store';
import { AUTH_COOKIE_LOCK_MANAGER } from './auth-cookie-lock';
import { Authentication } from './authentication';
import { administratorGuard, clientGuard } from './authentication-guards';
import { BootstrapApi } from './bootstrap-api';
import { authenticationInterceptor } from './authentication-interceptor';

const serialLockManager = (): LockManager => {
  let tail = Promise.resolve<unknown>(undefined);
  return {
    request: <A>(_name: string, callback: (lock: Lock) => Promise<A>) => {
      const result = tail.then(() => callback({} as Lock));
      tail = result.catch(() => undefined);
      return result;
    },
  } as LockManager;
};

describe('Authentication', () => {
  it('clears local sessions after password changes without retrying expired requests', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);
    const sessions = TestBed.inject(BrowserSessionStore);
    sessions.set({ mode: 'administrator', expiresAt: Date.now() + 600000 });
    const payload = { currentPassword: 'current-password-123', newPassword: 'new-password-123' };
    const result = auth.changePassword(payload);
    const request = http.expectOne('/api/auth/password');
    expect(request.request.body).toEqual(payload);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await expect(result).resolves.toEqual({ success: true });
    expect(sessions.mode()).toBeUndefined();
    const expired = auth.changePassword(payload);
    http
      .expectOne('/api/auth/password')
      .flush(
        { _tag: 'AuthenticationRequired', code: 'authentication.required' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await expect(expired).resolves.toMatchObject({
      success: false,
      code: 'authentication.required',
    });
    http.expectNone('/api/auth/refresh');
    http.verify();
  });
  it('uses Angular HttpClient for session and login requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);

    const status = auth.sessionMode();
    http.expectOne('/api/auth/refresh').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(status).resolves.toBe('administrator');

    const login = auth.authenticate('administrator@example.test', 'administrator-password');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'administrator@example.test',
      password: 'administrator-password',
    });
    request.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(login).resolves.toEqual({ success: true, mode: 'administrator' });

    http.verify();
  });

  it('restricts administrator and client routes to their session mode', async () => {
    let mode: LoginModeValue | undefined = 'client';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Authentication,
          useValue: { sessionMode: () => Promise.resolve(mode) },
        },
      ],
    });
    const router = TestBed.inject(Router);

    const administratorRedirect = await TestBed.runInInjectionContext(() =>
      administratorGuard({} as never, { url: '/backoffice/dashboard' } as never),
    );
    if (!(administratorRedirect instanceof UrlTree))
      throw new Error('The administrator redirect is missing.');
    expect(router.serializeUrl(administratorRedirect)).toBe('/backoffice/login');
    await expect(
      TestBed.runInInjectionContext(() =>
        clientGuard({} as never, { url: '/backoffice/client?quote=document-id' } as never),
      ),
    ).resolves.toBe(true);

    mode = 'administrator';
    await expect(
      TestBed.runInInjectionContext(() =>
        administratorGuard({} as never, { url: '/backoffice/dashboard' } as never),
      ),
    ).resolves.toBe(true);
    const clientRedirect = await TestBed.runInInjectionContext(() =>
      clientGuard({} as never, { url: '/backoffice/client?quote=document-id' } as never),
    );
    if (!(clientRedirect instanceof UrlTree)) throw new Error('The client redirect is missing.');
    expect(router.serializeUrl(clientRedirect)).toBe(
      '/backoffice/login?returnUrl=%2Fbackoffice%2Fclient%3Fquote%3Ddocument-id',
    );
  });

  it('keeps a newer login when a pending session refresh completes', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);

    const session = auth.sessionMode();
    const refreshRequest = http.expectOne('/api/auth/refresh');
    const login = auth.authenticate('client@example.test', 'client-password');
    http.expectOne('/api/auth/login').flush({
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    await expect(login).resolves.toEqual({ success: true, mode: 'client' });

    refreshRequest.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(session).resolves.toBe('client');
    expect(TestBed.inject(BrowserSessionStore).mode()).toBe('client');
    http.verify();
  });

  it('keeps a pending refresh cleared while logout completes', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);
    store.set({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    const refresh = store.refresh();
    const refreshRequest = http.expectOne('/api/auth/refresh');
    const logout = auth.signOut();
    const logoutRequest = http.expectOne('/api/auth/logout');
    expect(store.mode()).toBeUndefined();
    refreshRequest.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(refresh).resolves.toBeUndefined();
    expect(store.mode()).toBeUndefined();
    logoutRequest.flush(null);

    await expect(logout).resolves.toBe(true);
    http.verify();
  });

  it('serializes every auth cookie mutation in request order', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AUTH_COOKIE_LOCK_MANAGER, useFactory: serialLockManager },
      ],
    });
    const auth = TestBed.inject(Authentication);
    const bootstrap = TestBed.inject(BootstrapApi);
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);

    const refresh = store.refresh();
    const login = auth.authenticate('client@example.test', 'client-password');
    const logout = auth.signOut();
    const create = bootstrap.create({
      bootstrapPassword: 'bootstrap-password',
      email: 'administrator@example.test',
      password: 'administrator-password',
    });

    const refreshRequest = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
    http.expectNone('/api/auth/login');
    http.expectNone('/api/auth/logout');
    http.expectNone('/api/bootstrap');
    refreshRequest.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    await expect(refresh).resolves.toBe('client');

    const loginRequest = await vi.waitFor(() => http.expectOne('/api/auth/login'));
    http.expectNone('/api/auth/logout');
    http.expectNone('/api/bootstrap');
    loginRequest.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    await expect(login).resolves.toEqual({ success: true, mode: 'client' });

    const logoutRequest = await vi.waitFor(() => http.expectOne('/api/auth/logout'));
    http.expectNone('/api/bootstrap');
    logoutRequest.flush(null);
    await expect(logout).resolves.toBe(true);

    const bootstrapRequest = await vi.waitFor(() => http.expectOne('/api/bootstrap'));
    bootstrapRequest.flush({
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(create).resolves.toMatchObject({ success: true });
    expect(store.mode()).toBe('administrator');
    http.verify();
  });
});
