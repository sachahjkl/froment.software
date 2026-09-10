import {
  ApiTokenCreated,
  CreditNoteList,
  InvoiceCredits,
  InvoiceDetail,
  InvoiceHistory,
  InvoiceReceiptList,
  InvoiceRefundList,
} from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('protects global financial lists and returns only persisted invoice entries and history', async () => {
  const server = await startHttpTestServer();
  const post = (path: string, body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(body),
    });
  const get = (path: string) =>
    fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
  try {
    for (const path of ['/api/invoice-payments', '/api/credit-notes', '/api/invoice-refunds']) {
      expect((await fetch(`${server.baseUrl}${path}`)).status).toBe(401);
      const empty = await get(path);
      expect(empty.status).toBe(200);
      expect(await empty.json()).toEqual([]);
      expect(empty.headers.get('cache-control')).toContain('no-store');
    }
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
    const path = `/api/invoices/${draft.id}`;
    expect((await post(`${path}/issue`, { expectedVersion: draft.version })).status).toBe(200);
    let invoice = Schema.decodeUnknownSync(InvoiceDetail)(await (await get(path)).json());
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    invoice = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post(`${path}/payments`, {
          requestId: randomUUID(),
          expectedVersion: invoice.version,
          amountCents: 1000,
          paidOn: today,
          method: 'transfer',
          reference: 'RECEIPT-1',
        })
      ).json(),
    );
    const credit = Schema.decodeUnknownSync(InvoiceCredits)(
      await (
        await post(`${path}/credits`, {
          requestId: randomUUID(),
          expectedVersion: invoice.version,
          reason: 'Cancelled service',
        })
      ).json(),
    );
    expect(
      (
        await post(`${path}/refunds`, {
          requestId: randomUUID(),
          amountCents: 500,
          refundedOn: today,
          reference: 'REFUND-1',
        })
      ).status,
    ).toBe(200);
    const receipts = Schema.decodeUnknownSync(InvoiceReceiptList)(
      await (await get('/api/invoice-payments')).json(),
    );
    const notes = Schema.decodeUnknownSync(CreditNoteList)(
      await (await get('/api/credit-notes')).json(),
    );
    const refunds = Schema.decodeUnknownSync(InvoiceRefundList)(
      await (await get('/api/invoice-refunds')).json(),
    );
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: client.id,
      orderReference: invoice.orderReference,
      amountCents: 1000,
      reference: 'RECEIPT-1',
      cancelledAt: null,
    });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      id: credit.creditNote?.id,
      totalCents: invoice.currentRevision.totalCents,
    });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      invoiceId: invoice.id,
      amountCents: 500,
      reference: 'REFUND-1',
    });
    const otherClient = await createClient(server, 'Other invoice client');
    const otherQuote = await createQuote(server, otherClient.id);
    const otherOrder = await acceptQuote(server, otherQuote.id);
    const otherDraft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: otherOrder.accepted.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    const otherPath = `/api/invoices/${otherDraft.id}`;
    expect((await post(`${otherPath}/issue`, { expectedVersion: otherDraft.version })).status).toBe(
      200,
    );
    const history = Schema.decodeUnknownSync(InvoiceHistory)(
      await (await get(`${path}/history`)).json(),
    );
    const otherHistory = Schema.decodeUnknownSync(InvoiceHistory)(
      await (await get(`${otherPath}/history`)).json(),
    );
    for (const [invoiceId, events] of [
      [invoice.id, history],
      [otherDraft.id, otherHistory],
    ] as const) {
      expect(events.some((event) => event.action === 'invoice.created')).toBe(true);
      expect(events.some((event) => event.action === 'document.rendered')).toBe(true);
      expect(
        events.every(
          (event) =>
            (event.resourceType === 'invoice' && event.resourceId === invoiceId) ||
            (event.resourceType === 'document' && event.metadata['invoiceId'] === invoiceId),
        ),
      ).toBe(true);
    }
    const historyIds = new Set(history.map((event) => event.id));
    expect(otherHistory.some((event) => historyIds.has(event.id))).toBe(false);
    expect(history.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        'invoice.created',
        'invoice.issued',
        'invoice.payment-recorded',
        'invoice.credited',
        'invoice.refund-recorded',
      ]),
    );
    expect((await get('/api/invoices/01ARZ3NDEKTSV4RRFFQ69G5FAY/history')).status).toBe(404);
    const payment = receipts[0];
    const refund = refunds[0];
    if (!payment || !refund) throw new Error('invoice.workspace.test.entry_missing');
    expect(
      (await post(`${path}/refunds/${refund.id}/cancel`, { reason: 'Incorrect entry' })).status,
    ).toBe(200);
    expect(
      (
        await post(`${path}/payments/${payment.id}/cancel`, {
          expectedVersion: invoice.version,
          reason: 'Incorrect entry',
        })
      ).status,
    ).toBe(200);
    const corrected = Schema.decodeUnknownSync(InvoiceReceiptList)(
      await (await get('/api/invoice-payments')).json(),
    );
    expect(corrected[0]?.cancelledAt).not.toBeNull();
    expect(corrected).toHaveLength(1);
    for (const permissions of [
      ['invoice.read'],
      ['payment.read'],
      ['invoice.read', 'payment.read'],
    ]) {
      const token = Schema.decodeUnknownSync(ApiTokenCreated)(
        await (
          await post('/api/tokens', {
            name: permissions.join('+'),
            permissions,
            expiresAt: Date.now() + 86400000,
            rateLimitPerMinute: 60,
          })
        ).json(),
      );
      const headers = { authorization: `Bearer ${token.secret}` };
      expect((await fetch(`${server.baseUrl}${path}/history`, { headers })).status).toBe(403);
      for (const endpoint of ['/api/invoice-payments', '/api/invoice-refunds']) {
        expect((await fetch(`${server.baseUrl}${endpoint}`, { headers })).status).toBe(
          permissions.length === 2 ? 200 : 403,
        );
      }
      expect((await fetch(`${server.baseUrl}/api/credit-notes`, { headers })).status).toBe(
        permissions.includes('invoice.read') ? 200 : 403,
      );
    }
    const sqlite = new Sqlite(server.databaseFilename);
    try {
      const insert = sqlite.prepare(`insert into audit_events
        (id, action, actor_user_id, resource_type, resource_id, occurred_at, metadata)
        values (?, 'invoice.revised', null, 'invoice', ?, ?, '{}')`);
      sqlite
        .transaction(() => {
          for (let index = 0; index < 10001; index++)
            insert.run(ulid(), invoice.id, 1_788_000_000_000 + index);
        })
        .immediate();
      const limited = await get(`${path}/history`);
      expect(limited.status).toBe(413);
      expect(limited.headers.get('cache-control')).toContain('no-store');
      expect(await limited.json()).toEqual({
        _tag: 'InvoiceWorkspaceLimitExceeded',
        code: 'invoice.workspace_limit',
      });
      expect((await get(`${otherPath}/history`)).status).toBe(200);
      sqlite.prepare("delete from role_permissions where permission_code = 'audit.read'").run();
      expect((await get(`${otherPath}/history`)).status).toBe(403);
      expect((await get(`${path}/history`)).status).toBe(403);
    } finally {
      sqlite.close();
    }
  } finally {
    await server.close();
  }
}, 30000);
