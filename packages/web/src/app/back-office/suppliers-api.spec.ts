import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SuppliersApi } from './suppliers-api';

const supplier = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  displayName: 'Fournitures Exemple',
  addressLine1: '1 rue du Test',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  email: 'billing@example.test',
  phone: '+33 1 23 45 67 89',
  registrationNumber: '123456789',
  vatNumber: 'FR00123456789',
  defaultCurrency: 'EUR',
  paymentTermsDays: 30,
  iban: 'FR7630006000011234567890189',
  bic: 'AGRIFRPP',
  archived: false,
  updatedAt: 42,
};

describe('SuppliersApi', () => {
  it('validates reads and sends write payloads', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(SuppliersApi);
    const http = TestBed.inject(HttpTestingController);

    const list = api.list();
    http.expectOne('/api/suppliers').flush([supplier]);
    await expect(list).resolves.toEqual([supplier]);

    const detail = api.get(supplier.id);
    http.expectOne(`/api/suppliers/${supplier.id}`).flush(supplier);
    await expect(detail).resolves.toEqual({ success: true, result: supplier });

    const { id: _id, archived: _archived, updatedAt: _updatedAt, ...input } = supplier;
    const creation = { ...input, requestId: crypto.randomUUID() };
    const create = api.create(creation);
    const createRequest = http.expectOne('/api/suppliers');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(creation);
    createRequest.flush(supplier);
    await expect(create).resolves.toEqual({ success: true, result: supplier });

    const updatePayload = { ...input, expectedUpdatedAt: supplier.updatedAt };
    const update = api.update(supplier.id, updatePayload);
    const updateRequest = http.expectOne(`/api/suppliers/${supplier.id}`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(updatePayload);
    updateRequest.flush({ ...supplier, paymentTermsDays: 45, updatedAt: 43 });
    await expect(update).resolves.toMatchObject({ success: true });

    const archive = api.archive(supplier.id);
    const archiveRequest = http.expectOne(`/api/suppliers/${supplier.id}/archive`);
    expect(archiveRequest.request.method).toBe('POST');
    archiveRequest.flush({ ...supplier, archived: true, updatedAt: 43 });
    await expect(archive).resolves.toMatchObject({ success: true });

    const reactivate = api.reactivate(supplier.id);
    const reactivateRequest = http.expectOne(`/api/suppliers/${supplier.id}/reactivate`);
    expect(reactivateRequest.request.method).toBe('POST');
    reactivateRequest.flush({ ...supplier, updatedAt: 44 });
    await expect(reactivate).resolves.toMatchObject({ success: true });

    http.verify();
  });
});
