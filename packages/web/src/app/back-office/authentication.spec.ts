import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';

import { AccessTokenStore } from './access-token-store';
import { Authentication, administratorGuard, clientGuard } from './authentication';

describe('Authentication', () => {
  it('uses Angular HttpClient for session and login requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);

    const status = auth.sessionMode();
    http.expectOne('/api/auth/refresh').flush({
      accessToken: 'v4.public.test',
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
      accessToken: 'v4.public.login',
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

    const administratorRedirect = await TestBed.runInInjectionContext(() => administratorGuard());
    if (administratorRedirect === true) throw new Error('The administrator route was allowed.');
    expect(router.serializeUrl(administratorRedirect)).toBe('/backoffice/login');
    await expect(
      TestBed.runInInjectionContext(() =>
        clientGuard({} as never, { url: '/backoffice/client?quote=document-id' } as never),
      ),
    ).resolves.toBe(true);

    mode = 'administrator';
    await expect(TestBed.runInInjectionContext(() => administratorGuard())).resolves.toBe(true);
    const clientRedirect = (await TestBed.runInInjectionContext(() =>
      clientGuard({} as never, { url: '/backoffice/client?quote=document-id' } as never),
    )) as UrlTree;
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
      accessToken: 'v4.public.login',
      expiresAt: Date.now() + 600_000,
      mode: 'client',
    });
    await expect(login).resolves.toEqual({ success: true, mode: 'client' });

    refreshRequest.flush({
      accessToken: 'v4.public.stale',
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(session).resolves.toBe('client');
    expect(TestBed.inject(AccessTokenStore).token()).toBe('v4.public.login');
    http.verify();
  });

  it('keeps a pending refresh cleared while logout completes', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const store = TestBed.inject(AccessTokenStore);
    const http = TestBed.inject(HttpTestingController);
    store.set({
      accessToken: 'v4.public.session',
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });

    const refresh = store.refresh();
    const refreshRequest = http.expectOne('/api/auth/refresh');
    const logout = auth.signOut();
    const logoutRequest = http.expectOne('/api/auth/logout');
    expect(store.token()).toBeUndefined();
    expect(store.mode()).toBeUndefined();
    refreshRequest.flush({
      accessToken: 'v4.public.stale',
      expiresAt: Date.now() + 600_000,
      mode: 'administrator',
    });
    await expect(refresh).resolves.toBeUndefined();
    expect(store.token()).toBeUndefined();
    logoutRequest.flush(null);

    await expect(logout).resolves.toBe(true);
    http.verify();
  });
});
