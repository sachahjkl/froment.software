import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';

import {
  BackOfficeAuth,
  backOfficeAdministratorGuard,
  backOfficeClientGuard,
} from './back-office-auth';

describe('BackOfficeAuth', () => {
  it('uses Angular HttpClient for session and login requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(BackOfficeAuth);
    const http = TestBed.inject(HttpTestingController);

    const status = auth.sessionMode();
    http.expectOne('/api/auth/session').flush({ authenticated: true, mode: 'administrator' });
    await expect(status).resolves.toBe('administrator');

    const login = auth.authenticate('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'administrator');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      mode: 'administrator',
    });
    request.flush({ authenticated: true, mode: 'administrator' });
    await expect(login).resolves.toEqual({ success: true });

    http.verify();
  });

  it('restricts administrator and client routes to their session mode', async () => {
    let mode: LoginModeValue | undefined = 'client';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BackOfficeAuth,
          useValue: { sessionMode: () => Promise.resolve(mode) },
        },
      ],
    });
    const router = TestBed.inject(Router);

    const administratorRedirect = await TestBed.runInInjectionContext(() =>
      backOfficeAdministratorGuard(),
    );
    if (administratorRedirect === true) throw new Error('The administrator route was allowed.');
    expect(router.serializeUrl(administratorRedirect)).toBe('/backoffice/login?mode=admin');
    await expect(TestBed.runInInjectionContext(() => backOfficeClientGuard())).resolves.toBe(true);

    mode = 'administrator';
    await expect(TestBed.runInInjectionContext(() => backOfficeAdministratorGuard())).resolves.toBe(
      true,
    );
    const clientRedirect = await TestBed.runInInjectionContext(() => backOfficeClientGuard());
    if (clientRedirect === true) throw new Error('The client route was allowed.');
    expect(router.serializeUrl(clientRedirect)).toBe('/backoffice/login?mode=client');
  });
});
