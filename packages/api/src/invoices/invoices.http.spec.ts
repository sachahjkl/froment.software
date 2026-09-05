import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  acceptQuote,
  createClient,
  createClientSession,
  createQuote,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('invoice HTTP routes', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('creates, revises, issues, downloads, and terminates an invoice', async () => {
    await setIssuer(server);
    const client = await createClient(server);
    const clientSession = await createClientSession(server, client.id);
    const quote = await createQuote(server, client.id);
    const { accepted } = await acceptQuote(server, quote.id);
    const payload = {
      orderId: accepted.orderId,
      serviceDate: '2026-08-20',
      dueDate: '2026-09-19',
      paymentTerms: 'Payment due within 30 days.',
    };
    const create = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(payload),
    });
    expect(create.status).toBe(200);
    const invoice = (await create.json()) as {
      id: string;
      currentRevision: { lines: ReadonlyArray<object> };
    };
    const duplicate = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(payload),
    });
    expect(duplicate.status).toBe(409);

    const revision = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/revisions`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        expectedVersion: 1,
        title: 'Final invoice',
        refreshParties: false,
        serviceDate: payload.serviceDate,
        dueDate: payload.dueDate,
        paymentTerms: payload.paymentTerms,
        lines: invoice.currentRevision.lines,
      }),
    });
    expect(revision.status).toBe(200);
    const issues = await Promise.all([
      fetch(`${server.baseUrl}/api/invoices/${invoice.id}/issue`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
      fetch(`${server.baseUrl}/api/invoices/${invoice.id}/issue`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 2 }),
      }),
    ]);
    expect(issues.map(({ status }) => status)).toEqual([200, 200]);
    const issued = (await issues[0]!.json()) as { invoiceNumber: string; version: number };
    expect(issued).toMatchObject({ invoiceNumber: 'FA-2026-000001', version: 3 });

    const download = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/revisions/3/pdf`, {
      headers: server.sessionHeaders,
    });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('FA-2026-000001-v3.pdf');
    const pdf = Buffer.from(await download.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const clientDownload = await fetch(`${server.baseUrl}/api/client/invoices/${invoice.id}/pdf`, {
      headers: clientSession,
    });
    expect(Buffer.from(await clientDownload.arrayBuffer())).toEqual(pdf);

    const paid = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/mark-paid`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(paid.status).toBe(200);
    await expect(paid.json()).resolves.toMatchObject({ status: 'paid' });
    const voided = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(voided.status).toBe(409);

    const database = new Sqlite(server.databaseFilename, { readonly: true });
    expect(
      database
        .prepare(
          "select count(*) from audit_events where action = 'invoice.issued' and resource_id = ?",
        )
        .pluck()
        .get(invoice.id),
    ).toBe(1);
    expect(
      database
        .prepare(
          "select count(*) from audit_events where action = 'invoice.marked-paid' and resource_id = ?",
        )
        .pluck()
        .get(invoice.id),
    ).toBe(1);
    database.close();
  }, 20_000);

  it('validates invoice dates and authentication', async () => {
    expect((await fetch(`${server.baseUrl}/api/invoices`)).status).toBe(401);
    const response = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        orderId: '00000000000000000000000000',
        serviceDate: '2026-02-30',
        dueDate: '2026-03-01',
        paymentTerms: '',
      }),
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ code: 'invoice.invalid_dates' });
  });
});
