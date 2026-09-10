import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type CanActivateFn, provideRouter, Router, UrlTree } from '@angular/router';

import { Authentication } from './authentication';
import { administratorGuard, clientGuard } from './authentication-guards';
import { BrowserSessionStore } from './browser-session-store';

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
  it.each(['administrator', 'client', undefined] as const)(
    'applies the existing route policies for session mode %s',
    async (mode) => {
      const sessionMode = vi.fn().mockResolvedValue(mode);
      TestBed.configureTestingModule({
        providers: [provideRouter([]), { provide: Authentication, useValue: { sessionMode } }],
      });

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
      }));
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const injector = Injector.create({
        parent: TestBed.inject(Injector),
        providers: [{ provide: Authentication, useFactory: createAuthentication }],
      });
      const state = TestBed.inject(Router).routerState.snapshot;
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
