import {
  IntegrationOperation,
  IntegrationOperationList,
  IntegrationStatusList,
  IntegrationRetryList,
} from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

describe('integration simulations HTTP', () => {
  type SubmissionBody = Readonly<Record<string, string | number | undefined>>;
  it('persists all five simulations without business side effects and rejects conflicting retries', async () => {
    const server = await startHttpTestServer();
    try {
      const url = `${server.baseUrl}/api/integrations`;
      expect((await fetch(url)).status).toBe(401);
      expect((await fetch(`${url}/retries`)).status).toBe(401);
      const retries = await fetch(`${url}/retries`, { headers: server.sessionHeaders });
      expect(retries.status).toBe(200);
      expect(retries.headers.get('cache-control')).toContain('no-store');
      expect(Schema.decodeUnknownSync(IntegrationRetryList)(await retries.json())).toEqual([]);
      const statuses = await fetch(url, { headers: server.sessionHeaders });
      expect(statuses.status).toBe(200);
      expect(statuses.headers.get('cache-control')).toContain('no-store');
      expect(Schema.decodeUnknownSync(IntegrationStatusList)(await statuses.json())).toHaveLength(
        5,
      );
      const client = await createClient(server);
      const clientHeaders = await createClientSession(server, client.id);
      expect((await fetch(url, { headers: clientHeaders })).status).toBe(403);
      expect((await fetch(`${url}/operations`, { headers: clientHeaders })).status).toBe(403);
      expect((await fetch(`${url}/retries`, { headers: clientHeaders })).status).toBe(403);
      const requests = [
        { kind: 'email', recipient: 'test@example.test', subject: 'Test', body: 'Not sent.' },
        { kind: 'signature', artifactId: client.id, signerEmail: 'test@example.test' },
        { kind: 'payment', amountCents: 100, currency: 'EUR', customerEmail: 'test@example.test' },
        { kind: 'banking', accountReference: 'SIMULATION', from: '2026-01-01', to: '2026-01-31' },
        { kind: 'electronic-invoice', artifactId: client.id },
      ];
      const post = (body: SubmissionBody, headers = server.jsonHeaders) =>
        fetch(`${url}/operations`, {
          method: 'POST',
          headers: { origin: server.baseUrl, ...headers },
          body: JSON.stringify(body),
        });
      for (const request of requests) {
        const payload = {
          ...request,
          requestId: randomUUID(),
          reference: 'SIMULATION',
          expectedMode: 'simulation',
        };
        const response = await post(payload);
        expect(response.status).toBe(200);
        const operation = Schema.decodeUnknownSync(IntegrationOperation)(await response.json());
        expect(operation.receipt).toMatchObject({ mode: 'simulation', status: 'simulated' });
        expect(await (await post(payload)).json()).toEqual(operation);
      }
      const database = new Sqlite(server.databaseFilename);
      try {
        expect(
          database.prepare('select count(*) as count from integration_operations').get(),
        ).toEqual({ count: 5 });
        expect(() =>
          database.prepare("update integration_operations set request = '{}' ").run(),
        ).toThrow();
        expect(() => database.prepare('delete from integration_operations').run()).toThrow();
        expect(() =>
          database.prepare('update integration_operations set receipt = null').run(),
        ).toThrow();
        expect(
          database
            .prepare("select count(*) as count from audit_events where action like 'integration.%'")
            .get(),
        ).toEqual({ count: 10 });
        expect(database.prepare('select count(*) as count from invoice_payments').get()).toEqual({
          count: 0,
        });
        const history = await fetch(`${url}/operations`, { headers: server.sessionHeaders });
        expect(
          Schema.decodeUnknownSync(IntegrationOperationList)(await history.json()),
        ).toHaveLength(5);
        const emails = await fetch(`${url}/operations?kind=email`, {
          headers: server.sessionHeaders,
        });
        const emailHistory = Schema.decodeUnknownSync(IntegrationOperationList)(
          await emails.json(),
        );
        expect(emailHistory).toHaveLength(1);
        expect(emailHistory[0]?.request.kind).toBe('email');
        expect(
          (await fetch(`${url}/operations?kind=unknown`, { headers: server.sessionHeaders }))
            .status,
        ).toBe(400);
      } finally {
        database.close();
      }
    } finally {
      await server.close();
    }
  }, 20000);

  it('validates requests, ownership permissions, rate limits, and idempotency', async () => {
    const server = await startHttpTestServer();
    try {
      const url = `${server.baseUrl}/api/integrations/operations`;
      const payload = {
        kind: 'email',
        requestId: randomUUID(),
        reference: 'TEST',
        recipient: 'test@example.test',
        subject: 'Test',
        body: 'Not sent.',
        expectedMode: 'simulation',
      };
      const post = (body: SubmissionBody, headers = server.jsonHeaders) =>
        fetch(url, {
          method: 'POST',
          headers: { origin: server.baseUrl, ...headers },
          body: JSON.stringify(body),
        });
      const client = await createClient(server);
      const clientHeaders = await createClientSession(server, client.id);
      expect(
        (await post(payload, { ...clientHeaders, 'content-type': 'application/json' })).status,
      ).toBe(403);
      expect(
        (await post(payload, { ...server.jsonHeaders, origin: 'https://untrusted.example' }))
          .status,
      ).toBe(403);
      expect((await post(payload)).status).toBe(200);
      expect((await post({ ...payload, body: 'Changed' })).status).toBe(409);
      expect((await post({ ...payload, recipient: 'invalid' })).status).toBe(400);
      expect(
        (
          await post({
            kind: 'banking',
            requestId: randomUUID(),
            reference: 'TEST',
            accountReference: 'TEST',
            from: '2026-02-01',
            to: '2026-01-01',
            expectedMode: 'simulation',
          })
        ).status,
      ).toBe(422);
      expect(
        (await post({ ...payload, requestId: randomUUID(), expectedMode: 'live' })).status,
      ).toBe(409);
      let response = await post(payload);
      for (let index = 0; index < 10 && response.status !== 429; index++)
        response = await post(payload);
      expect(response.status).toBe(429);
    } finally {
      await server.close();
    }
  }, 20000);
});
