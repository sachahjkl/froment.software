import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';

import { Authentication, administratorGuard, clientGuard } from './authentication';

describe('Authentication', () => {
  it('uses Angular HttpClient for session and login requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(Authentication);
    const http = TestBed.inject(HttpTestingController);

    const status = auth.sessionMode();
    http.expectOne('/api/auth/session').flush({ authenticated: true, mode: 'administrator' });
    await expect(status).resolves.toBe('administrator');

    const login = auth.authenticate('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    request.flush({ authenticated: true, mode: 'administrator' });
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
});
