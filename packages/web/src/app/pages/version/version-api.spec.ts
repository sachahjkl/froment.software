import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { VersionApi } from './version-api';

describe('VersionApi', () => {
  it('validates deployment metadata from the server', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(VersionApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.get();
    http.expectOne('/api/version').flush({
      commit: '6c9757782e249d4db6ffb804349b7da620494565',
      packages: [{ name: '@froment/web', version: '0.2.4' }],
    });

    await expect(result).resolves.toMatchObject({
      commit: '6c9757782e249d4db6ffb804349b7da620494565',
    });
    http.verify();
  });

  it('rejects invalid deployment metadata', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(VersionApi);
    const http = TestBed.inject(HttpTestingController);
    const result = api.get();
    http.expectOne('/api/version').flush({ commit: 'dirty', packages: [] });

    await expect(result).rejects.toThrow();
    http.verify();
  });
});
