import { CustomRole, CustomRoleList } from '@froment/contracts';
import { Schema } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

describe('custom role HTTP lifecycle', () => {
  let server: HttpTestServer;

  beforeAll(async () => {
    server = await startHttpTestServer();
  }, 30_000);
  afterAll(async () => server.close());

  it('creates, lists, updates, and deletes a custom role', async () => {
    const requestId = crypto.randomUUID();
    const creation = {
      requestId,
      name: 'Gestion des achats',
      permissions: ['supplier.read', 'supplier.create'],
    };
    const createResponse = await fetch(`${server.baseUrl}/api/roles`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(creation),
    });
    expect(createResponse.status).toBe(200);
    const created = Schema.decodeUnknownSync(CustomRole)(await createResponse.json());
    expect(created).toMatchObject({ name: creation.name, permissions: creation.permissions });

    const repeatedResponse = await fetch(`${server.baseUrl}/api/roles`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(creation),
    });
    expect(repeatedResponse.status).toBe(200);
    await expect(repeatedResponse.json()).resolves.toMatchObject({ id: created.id });

    const listResponse = await fetch(`${server.baseUrl}/api/roles`, {
      headers: server.sessionHeaders,
    });
    expect(listResponse.status).toBe(200);
    expect(Schema.decodeUnknownSync(CustomRoleList)(await listResponse.json())).toHaveLength(1);

    const updateResponse = await fetch(`${server.baseUrl}/api/roles/${created.id}`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        name: 'Responsable achats',
        permissions: ['supplier.read', 'supplier.create', 'supplier.update'],
        expectedVersion: created.version,
      }),
    });
    expect(updateResponse.status).toBe(200);
    const updated = Schema.decodeUnknownSync(CustomRole)(await updateResponse.json());
    expect(updated).toMatchObject({ name: 'Responsable achats', version: 2 });

    const staleResponse = await fetch(`${server.baseUrl}/api/roles/${created.id}`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        name: 'Ancien nom',
        permissions: [],
        expectedVersion: created.version,
      }),
    });
    expect(staleResponse.status).toBe(409);

    const deleteResponse = await fetch(`${server.baseUrl}/api/roles/${created.id}`, {
      method: 'DELETE',
      headers: server.jsonHeaders,
    });
    expect(deleteResponse.status).toBe(204);
    expect(
      (
        await fetch(`${server.baseUrl}/api/roles/${created.id}`, {
          headers: server.sessionHeaders,
        })
      ).status,
    ).toBe(404);
  });

  it('rejects unauthenticated reads and duplicate names', async () => {
    expect((await fetch(`${server.baseUrl}/api/roles`)).status).toBe(401);
    const first = {
      requestId: crypto.randomUUID(),
      name: 'Lecture seule',
      permissions: ['client.read'],
    };
    expect(
      (
        await fetch(`${server.baseUrl}/api/roles`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify(first),
        })
      ).status,
    ).toBe(200);
    const duplicate = await fetch(`${server.baseUrl}/api/roles`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ ...first, requestId: crypto.randomUUID(), name: 'lecture seule' }),
    });
    expect(duplicate.status).toBe(409);
  });
});
