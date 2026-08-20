import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClientsApi } from './clients-api';

describe('ClientsApi', () => {
  it('validates lists and sends the CSRF token on writes', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withXsrfConfiguration({
            cookieName: '__Host-froment-csrf',
            headerName: 'X-CSRF-Token',
          }),
        ),
        provideHttpClientTesting(),
        {
          provide: DOCUMENT,
          useValue: {
            cookie: '__Host-froment-csrf=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
        },
      ],
    });
    const api = TestBed.inject(ClientsApi);
    const http = TestBed.inject(HttpTestingController);

    const list = api.list();
    http.expectOne('/api/clients').flush([]);
    await expect(list).resolves.toEqual([]);

    const client = {
      displayName: 'Acme',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
    };
    const create = api.create(client);
    const request = http.expectOne('/api/clients');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-csrf-token')).toBe(
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(request.request.body).toEqual(client);
    request.flush({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      displayName: 'Acme',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
      archived: false,
    });
    await expect(create).resolves.toMatchObject({ success: true });

    http.verify();
  });
});
