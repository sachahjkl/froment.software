import { SupplierList, SupplierSummary } from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

const input = {
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
};

describe('supplier HTTP lifecycle', () => {
  let server: HttpTestServer;

  beforeAll(async () => {
    server = await startHttpTestServer();
  }, 30_000);
  afterAll(async () => server.close());

  it('creates, updates, archives, and restores a supplier', async () => {
    const create = await fetch(`${server.baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ ...input, requestId: randomUUID() }),
    });
    expect(create.status).toBe(200);
    const supplier = Schema.decodeUnknownSync(SupplierSummary)(await create.json());

    const update = await fetch(`${server.baseUrl}/api/suppliers/${supplier.id}`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        ...input,
        paymentTermsDays: 45,
        expectedUpdatedAt: supplier.updatedAt,
      }),
    });
    expect(update.status).toBe(200);
    const changed = Schema.decodeUnknownSync(SupplierSummary)(await update.json());
    expect(changed.paymentTermsDays).toBe(45);

    const archive = await fetch(`${server.baseUrl}/api/suppliers/${supplier.id}/archive`, {
      method: 'POST',
      headers: server.jsonHeaders,
    });
    expect(archive.status).toBe(200);
    expect(Schema.decodeUnknownSync(SupplierSummary)(await archive.json()).archived).toBe(true);

    const reactivate = await fetch(`${server.baseUrl}/api/suppliers/${supplier.id}/reactivate`, {
      method: 'POST',
      headers: server.jsonHeaders,
    });
    expect(reactivate.status).toBe(200);
    expect(Schema.decodeUnknownSync(SupplierSummary)(await reactivate.json()).archived).toBe(false);

    const list = await fetch(`${server.baseUrl}/api/suppliers`, {
      headers: server.sessionHeaders,
    });
    expect(Schema.decodeUnknownSync(SupplierList)(await list.json())).toHaveLength(1);
  });

  it('rejects unauthenticated and invalid requests', async () => {
    expect((await fetch(`${server.baseUrl}/api/suppliers`)).status).toBe(401);
    const invalid = await fetch(`${server.baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ ...input, defaultCurrency: 'EURO', requestId: randomUUID() }),
    });
    expect(invalid.status).toBe(400);
  });
});
