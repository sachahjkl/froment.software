import { afterAll, beforeAll, expect, it } from 'vitest';
import { Schema } from 'effect';
import { EmailTestOperation, ProviderConnections } from '@froment/contracts';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

let server: HttpTestServer;
beforeAll(async () => {
  server = await startHttpTestServer();
});
afterAll(async () => {
  await server.close();
});

it('reports credential presence without exposing keys and isolates the test from commercial sending', async () => {
  const anonymous = await fetch(`${server.baseUrl}/api/integrations/connections`);
  expect(anonymous.status).toBe(401);
  const response = await fetch(`${server.baseUrl}/api/integrations/connections`, {
    headers: server.sessionHeaders,
  });
  expect(response.status).toBe(200);
  const connections = Schema.decodeUnknownSync(ProviderConnections)(await response.json());
  expect(connections).toHaveLength(4);
  expect(connections.every((connection) => !connection.credentialsPresent)).toBe(true);
  const request = {
    requestId: randomUUID(),
    subject: 'HTTP test',
    body: 'No external call is permitted.',
  };
  const rejected = await fetch(`${server.baseUrl}/api/integrations/email-tests`, {
    method: 'POST',
    headers: { ...server.jsonHeaders, origin: 'https://untrusted.example' },
    body: JSON.stringify(request),
  });
  expect(rejected.status).toBe(403);
  const created = await fetch(`${server.baseUrl}/api/integrations/email-tests`, {
    method: 'POST',
    headers: { ...server.jsonHeaders, origin: server.baseUrl },
    body: JSON.stringify(request),
  });
  expect(created.status).toBe(200);
  const operation = Schema.decodeUnknownSync(EmailTestOperation)(await created.json());
  expect(operation.request).toEqual(request);
  expect(operation.providerId).toBeNull();
  expect(JSON.stringify(operation)).not.toContain('accountKey');
  const replay = await fetch(`${server.baseUrl}/api/integrations/email-tests`, {
    method: 'POST',
    headers: { ...server.jsonHeaders, origin: server.baseUrl },
    body: JSON.stringify({ ...request, subject: 'Changed' }),
  });
  expect(replay.status).toBe(409);
  const database = new Database(server.databaseFilename);
  try {
    database
      .prepare("delete from role_permissions where permission_code = 'integration.configure'")
      .run();
    const denied = await fetch(`${server.baseUrl}/api/integrations/email-tests`, {
      headers: server.sessionHeaders,
    });
    expect(denied.status).toBe(403);
    expect(database.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
  } finally {
    database.close();
  }
  expect(server.output()).not.toContain('Bearer');
});
