import {
  Api,
  EmailActions,
  SignatureActions,
  PaymentActions,
  BankingActions,
  ElectronicInvoiceActions,
} from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { expect, it } from 'vitest';
import {
  createClient,
  createClientSession,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

const groups: ReadonlyArray<{
  path: string;
  actions: Readonly<
    Record<
      string,
      {
        request: Schema.Codec<unknown, unknown, never, never>;
        response: Schema.Codec<unknown, unknown, never, never>;
      }
    >
  >;
}> = [
  { path: 'email', actions: EmailActions },
  { path: 'signature', actions: SignatureActions },
  { path: 'payment', actions: PaymentActions },
  { path: 'banking', actions: BankingActions },
  { path: 'electronic-invoice', actions: ElectronicInvoiceActions },
];
const pathNames = new Map([
  ['signedDocument', 'document'],
  ['getConnection', 'connection'],
  ['revokeConnection', 'revoke'],
  ['getRefund', 'get-refund'],
  ['verifyWebhook', 'verify-webhook'],
  ['getReport', 'get-report'],
]);
const input = {
  requestId: '91ff5717-c394-4708-bef2-6b5f5cafbdaa',
  providerId: 'test-provider-id',
  reason: 'test-cancellation',
  cursor: null,
  limit: 10,
  amountCents: 12500,
  bodyBase64: 'e30=',
  signature: 'invalid-signature',
  receivedAt: '2026-01-01T00:00:00.000Z',
  from: '2026-01-01',
  to: '2026-01-31',
  returnUrl: 'https://example.test/return',
  accountReference: 'test-account',
  entries: [
    { invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV', amountCents: 12500, currency: 'EUR', paidOn: null },
  ],
};

it('executes every provider contract through its mock without creating business effects', async () => {
  const server = await startHttpTestServer();
  const database = new Sqlite(server.databaseFilename);
  try {
    const count = () =>
      [
        'integration_operations',
        'invoice_payments',
        'bank_transactions',
        'document_artifacts',
        'quote_signatures',
      ].map((table) => database.prepare(`select count(*) from ${table}`).pluck().get());
    const before = count();
    let checked = 0;
    for (const group of groups) {
      for (const [name, contract] of Object.entries(group.actions)) {
        const payload = Schema.decodeUnknownSync(contract.request)(input);
        const response = await fetch(
          `${server.baseUrl}/api/providers/${group.path}/${pathNames.get(name) ?? name}`,
          {
            method: 'POST',
            headers: { ...server.jsonHeaders, origin: server.baseUrl },
            body: JSON.stringify(payload),
          },
        );
        expect(response.status, `${group.path}.${name}`).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        const result = await response.json();
        expect(() => Schema.decodeUnknownSync(contract.response)(result)).not.toThrow();
        expect(result).toMatchObject({
          mode: 'simulation',
          executed: false,
          requestId: input.requestId,
        });
        expect(result).not.toHaveProperty('result');
        if (name === 'verifyWebhook')
          expect(result).toMatchObject({ preview: { verified: false, events: [] } });
        if (['signedDocument', 'proof', 'download'].includes(name))
          expect(result).toMatchObject({ preview: { available: false } });
        checked++;
      }
    }
    expect(checked).toBe(32);
    expect(checked).toBe(Object.keys(Api.groups.providerActions.endpoints).length);
    expect(count()).toEqual(before);
    const url = `${server.baseUrl}/api/providers/payment/refund`;
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: server.baseUrl },
          body: JSON.stringify(input),
        })
      ).status,
    ).toBe(401);
    const client = await createClient(server);
    const headers = await createClientSession(server, client.id);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json', origin: server.baseUrl },
          body: JSON.stringify(input),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: 'https://attacker.example' },
          body: JSON.stringify(input),
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url, {
          method: 'POST',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify({ ...input, amountCents: -1 }),
        })
      ).status,
    ).toBe(400);
  } finally {
    database.close();
    await server.close();
  }
}, 20000);
