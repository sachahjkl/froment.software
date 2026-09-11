import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type CanActivateFn, provideRouter, Router, UrlTree } from '@angular/router';

import { Authentication } from './authentication';
import {
  administratorGuard,
  administratorChildGuard,
  clientGuard,
  permissionData,
  permissionsGuard,
  sessionData,
} from './authentication-guards';
import { accountFixture } from './account.spec-helper';
import { BrowserSessionStore } from './browser-session-store';
import { authenticationInterceptor } from './authentication-interceptor';
import { AUTH_COOKIE_LOCK_MANAGER } from './auth-cookie-lock';
import type { PermissionCodeValue } from '@froment/contracts';

const accountResponse = (permissions: readonly PermissionCodeValue[]) => ({
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  email: 'admin@example.test',
  mode: 'administrator',
  permissions,
});

@Component({ template: '' })
class GuardedPage {}

const clientUrl = '/backoffice/client/quotes/document-id?quote=a%2Fb&query=%C3%A9%20%2B#details';

const runGuard = (guard: CanActivateFn, url: string) => {
  const router = TestBed.inject(Router);
  const state = router.routerState.snapshot;
  state.url = url;
  return TestBed.runInInjectionContext(() => guard(state.root, state));
};

const expectLoginRedirect = (result: Awaited<ReturnType<CanActivateFn>>, returnUrl?: string) => {
  expect(result).toBeInstanceOf(UrlTree);
  if (!(result instanceof UrlTree)) throw new Error('The guard did not return a redirect.');
  expect(result.queryParams).toEqual(returnUrl === undefined ? {} : { returnUrl });
  expect(TestBed.inject(Router).serializeUrl(result)).toBe(
    returnUrl === undefined
      ? '/backoffice/login'
      : `/backoffice/login?returnUrl=${encodeURIComponent(returnUrl)}`,
  );
};

describe('authentication guards', () => {
  it('allows the guard after an account 401 followed by a successful session refresh', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authenticationInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_COOKIE_LOCK_MANAGER, useValue: undefined },
      ],
    });
    TestBed.inject(BrowserSessionStore).set({
      mode: 'administrator',
      expiresAt: Date.now() + 600_000,
    });
    TestBed.inject(Router).routerState.snapshot.root.data = permissionData('client.read');
    const http = TestBed.inject(HttpTestingController);
    const result = runGuard(administratorGuard, '/backoffice/clients');
    const initial = await vi.waitFor(() => http.expectOne('/api/auth/account'));
    initial.flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = await vi.waitFor(() => http.expectOne('/api/auth/refresh'));
    refresh.flush({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    const retry = await vi.waitFor(() => http.expectOne('/api/auth/account'));
    retry.flush(accountResponse(['client.read']));
    await expect(result).resolves.toBe(true);
    http.verify();
  });

  it('reloads permissions on child navigation and retains parent requirements', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'clients',
            component: GuardedPage,
            canActivate: [administratorGuard],
            canActivateChild: [administratorChildGuard],
            data: permissionData('client.read'),
            children: [
              { path: 'active', component: GuardedPage },
              {
                path: 'archived',
                component: GuardedPage,
                canActivate: [permissionsGuard],
                data: permissionData('quote.read'),
              },
            ],
          },
          { path: 'backoffice/account', component: GuardedPage },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    TestBed.inject(BrowserSessionStore).set({
      mode: 'administrator',
      expiresAt: Date.now() + 600_000,
    });
    const router = TestBed.inject(Router);
    const http = TestBed.inject(HttpTestingController);
    const first = router.navigateByUrl('/clients/active');
    (await vi.waitFor(() => http.expectOne('/api/auth/account'))).flush(
      accountResponse(['client.read', 'quote.read']),
    );
    await first;
    expect(router.url).toBe('/clients/active');
    const next = router.navigateByUrl('/clients/archived');
    (await vi.waitFor(() => http.expectOne('/api/auth/account'))).flush(
      accountResponse(['quote.read']),
    );
    await next;
    expect(router.url).toBe('/backoffice/account');
    http.verify();
  });

  it('checks declared effective permissions without granting administrator-mode write access', async () => {
    const context = accountFixture(['client.read']);
    TestBed.configureTestingModule({ providers: [provideRouter([]), context.provider] });
    const router = TestBed.inject(Router);
    const route = router.routerState.snapshot.root;
    route.data = permissionData('client.read');
    expect(await runGuard(administratorGuard, '/backoffice/clients')).toBe(true);
    route.data = permissionData('client.create');
    const denied = await runGuard(administratorGuard, '/backoffice/clients/new');
    expect(denied).toBeInstanceOf(UrlTree);
    if (denied instanceof UrlTree) expect(router.serializeUrl(denied)).toBe('/backoffice/account');
    route.data = {};
    expect(await runGuard(permissionsGuard, '/backoffice/clients/new')).toBeInstanceOf(UrlTree);
  });
  it.each(['administrator', 'client', undefined] as const)(
    'applies the existing route policies for session mode %s',
    async (mode) => {
      const sessionMode = vi.fn().mockResolvedValue(mode);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          {
            provide: Authentication,
            useValue: { sessionMode, refreshAccount: async () => ({ mode, permissions: [] }) },
          },
        ],
      });

      TestBed.inject(Router).routerState.snapshot.root.data = sessionData();
      const administratorResult = await runGuard(administratorGuard, '/backoffice/team?role=all');
      if (mode === 'administrator') expect(administratorResult).toBe(true);
      else expectLoginRedirect(administratorResult);

      const clientResult = await runGuard(clientGuard, clientUrl);
      if (mode === 'client') expect(clientResult).toBe(true);
      else expectLoginRedirect(clientResult, clientUrl);
      expect(sessionMode).toHaveBeenCalledTimes(2);
    },
  );

  it.each([administratorGuard, clientGuard])(
    'resolves authentication from the captured route injector after loading',
    async (guard) => {
      const mode = guard === administratorGuard ? 'administrator' : 'client';
      const createAuthentication = vi.fn(() => ({
        sessionMode: () => Promise.resolve(mode),
        refreshAccount: async () => ({ mode, permissions: [] }),
      }));
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const injector = Injector.create({
        parent: TestBed.inject(Injector),
        providers: [{ provide: Authentication, useFactory: createAuthentication }],
      });
      const state = TestBed.inject(Router).routerState.snapshot;
      state.root.data = sessionData();
      try {
        const result = runInInjectionContext(injector, () => guard(state.root, state));

        expect(createAuthentication).not.toHaveBeenCalled();
        await expect(result).resolves.toBe(true);
        expect(createAuthentication).toHaveBeenCalledTimes(1);
      } finally {
        injector.destroy();
      }
    },
  );

  it('keeps the SSR redirects without refreshing or trusting cached browser sessions', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    });
    const store = TestBed.inject(BrowserSessionStore);
    const http = TestBed.inject(HttpTestingController);

    expectLoginRedirect(await runGuard(administratorGuard, '/backoffice/team'));
    expectLoginRedirect(await runGuard(clientGuard, clientUrl), clientUrl);

    store.set({ mode: 'administrator', expiresAt: Date.now() + 600_000 });
    expectLoginRedirect(await runGuard(administratorGuard, '/backoffice/team'));

    store.set({ mode: 'client', expiresAt: Date.now() + 600_000 });
    expectLoginRedirect(await runGuard(clientGuard, clientUrl), clientUrl);

    http.expectNone('/api/auth/refresh');
    http.verify();
  });
});
