import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClientsApi } from './clients-api';

describe('ClientsApi', () => {
  it('validates lists and sends write payloads', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
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
    const storedClient = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      ...client,
      archived: false,
      updatedAt: 42,
    };
    const create = api.create(client);
    const request = http.expectOne('/api/clients');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(client);
    request.flush(storedClient);
    await expect(create).resolves.toMatchObject({ success: true });

    const detail = api.get(storedClient.id);
    http.expectOne(`/api/clients/${storedClient.id}`).flush(storedClient);
    await expect(detail).resolves.toEqual({ success: true, result: storedClient });

    const update = api.update(storedClient.id, { ...client, expectedUpdatedAt: 42 });
    const updateRequest = http.expectOne(`/api/clients/${storedClient.id}`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ ...client, expectedUpdatedAt: 42 });
    updateRequest.flush({ ...storedClient, displayName: 'Acme updated', updatedAt: 43 });
    await expect(update).resolves.toMatchObject({ success: true });

    const access = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      clientId: storedClient.id,
      email: 'portal@acme.example',
      createdAt: 1_700_000_000_000,
    };
    const accessList = api.listAccess(storedClient.id);
    http.expectOne(`/api/clients/${storedClient.id}/access`).flush([access]);
    await expect(accessList).resolves.toEqual({ success: true, result: [access] });

    const revoke = api.revokeAccess(storedClient.id, access.id);
    const revokeRequest = http.expectOne(`/api/clients/${storedClient.id}/access/${access.id}`);
    expect(revokeRequest.request.method).toBe('DELETE');
    revokeRequest.flush(null);
    await expect(revoke).resolves.toEqual({ success: true, result: null });

    http.verify();
  });
});
