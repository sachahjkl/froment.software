import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RolesApi } from './roles-api';

const role = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'Purchasing',
  permissions: ['supplier.read'] as const,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
};

describe('RolesApi', () => {
  it('sends the custom role lifecycle requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(RolesApi);
    const http = TestBed.inject(HttpTestingController);

    const list = api.list();
    http.expectOne('/api/roles').flush([role]);
    await expect(list).resolves.toMatchObject({ success: true });

    const get = api.get(role.id);
    http.expectOne(`/api/roles/${role.id}`).flush(role);
    await expect(get).resolves.toMatchObject({ success: true });

    const creation = {
      requestId: crypto.randomUUID(),
      name: role.name,
      permissions: role.permissions,
    };
    const create = api.create(creation);
    const createRequest = http.expectOne('/api/roles');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(creation);
    createRequest.flush(role);
    await expect(create).resolves.toMatchObject({ success: true });

    const updatePayload = { name: role.name, permissions: role.permissions, expectedVersion: 1 };
    const update = api.update(role.id, updatePayload);
    const updateRequest = http.expectOne(`/api/roles/${role.id}`);
    expect(updateRequest.request.method).toBe('PUT');
    updateRequest.flush({ ...role, version: 2, updatedAt: 2 });
    await expect(update).resolves.toMatchObject({ success: true });

    const remove = api.remove(role.id);
    const deleteRequest = http.expectOne(`/api/roles/${role.id}`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await expect(remove).resolves.toEqual({ success: true, result: null });
    http.verify();
  });
});
