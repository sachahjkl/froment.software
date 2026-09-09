import { CheckoutConnection, CheckoutList, InvoiceDetail } from '@froment/contracts';
import { Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import Sqlite from 'better-sqlite3';
import Stripe from 'stripe';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('protects Checkout APIs, rejects stale invoices, and leaves commercial records untouched', async () => {
  const secret = 'whsec_http_test';
  const server = await startHttpTestServer({ stripeWebhookSecret: secret });
  const post = (path: string, body: typeof Schema.Json.Type, origin = server.baseUrl) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin },
      body: JSON.stringify(body),
    });
  const get = (path: string) =>
    fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
  try {
    expect((await fetch(`${server.baseUrl}/api/integrations/checkout`)).status).toBe(401);
    expect(
      Schema.decodeUnknownSync(CheckoutConnection)(
        await (await get('/api/integrations/checkout/connection')).json(),
      ),
    ).toEqual({ credentialsPresent: false, testKey: false, webhookConfigured: true });
    await setIssuer(server);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    const draft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    const request = {
      requestId: randomUUID(),
      invoiceId: draft.id,
      expectedVersion: draft.version,
    };
    expect(
      (await post('/api/integrations/checkout', request, 'https://untrusted.example')).status,
    ).toBe(403);
    expect((await post('/api/integrations/checkout', request)).status).toBe(409);
    expect(
      (await post(`/api/invoices/${draft.id}/issue`, { expectedVersion: draft.version })).status,
    ).toBe(200);
    const issued = Schema.decodeUnknownSync(InvoiceDetail)(
      await (await get(`/api/invoices/${draft.id}`)).json(),
    );
    const issuedRequest = { ...request, expectedVersion: issued.version };
    expect((await post('/api/integrations/checkout', issuedRequest)).status).toBe(200);
    expect((await post('/api/integrations/checkout', issuedRequest)).status).toBe(200);
    const entries = Schema.decodeUnknownSync(CheckoutList)(
      await (await get('/api/integrations/checkout')).json(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ request: issuedRequest, mode: 'test', sessionId: null });
    expect(JSON.stringify(entries)).not.toContain('accountKey');
    expect((await post('/api/integrations/stripe/webhook', {})).status).toBe(400);
    const db = new Sqlite(server.databaseFilename);
    try {
      db.prepare(
        "update checkout_operations set status = 'open', session_id = 'cs_test_http', next_attempt_at = null",
      ).run();
      const body = JSON.stringify({
        id: 'evt_http',
        livemode: false,
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_test_http', payment_status: 'paid' } },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
      const notify = (payload: string) =>
        fetch(`${server.baseUrl}/api/integrations/stripe/webhook`, {
          method: 'POST',
          headers: { 'stripe-signature': signature, 'content-type': 'application/json' },
          body: payload,
        });
      expect((await notify(`${body} `)).status).toBe(400);
      expect((await notify(body)).status).toBe(200);
      expect((await notify(body)).status).toBe(200);
      expect(db.prepare('select count(*) from checkout_events').pluck().get()).toBe(1);
      expect(db.prepare('select status from checkout_operations').pluck().get()).toBe('open');
      db.prepare(
        "delete from role_permissions where permission_code = 'integration.configure'",
      ).run();
      expect((await get('/api/integrations/checkout')).status).toBe(403);
      expect(db.prepare('select count(*) from invoice_payments').pluck().get()).toBe(0);
      expect(db.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
    } finally {
      db.close();
    }
    expect(server.output()).not.toContain('sk_test');
  } finally {
    await server.close();
  }
});
