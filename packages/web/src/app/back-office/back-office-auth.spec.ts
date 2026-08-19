import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { BackOfficeAuth } from './back-office-auth';

describe('BackOfficeAuth', () => {
  it('uses Angular HttpClient for session and login requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const auth = TestBed.inject(BackOfficeAuth);
    const http = TestBed.inject(HttpTestingController);

    const status = auth.isAuthenticated();
    http.expectOne('/api/auth/session').flush({ authenticated: true });
    await expect(status).resolves.toBe(true);

    const login = auth.authenticate('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'administrator');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      mode: 'administrator',
    });
    request.flush({ authenticated: true });
    await expect(login).resolves.toEqual({ success: true });

    http.verify();
  });
});
