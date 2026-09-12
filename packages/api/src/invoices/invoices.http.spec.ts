import Sqlite from 'better-sqlite3';
import { Schema } from 'effect';
import { InvoiceDetail, ClientInvoiceList } from '@froment/contracts';
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
      currentRevision: { lines: ReadonlyArray<object>; totalCents: number };
    };
    const duplicate = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(payload),
    });
    expect(duplicate.status).toBe(409);
    const preview = await fetch(
      `${server.baseUrl}/api/invoices/${invoice.id}/revisions/1/preview`,
      { headers: server.sessionHeaders },
    );
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-disposition')).toBe(
      `inline; filename="preview-facture-${invoice.id}-v1.pdf"`,
    );
    expect(preview.headers.get('cache-control')).toContain('no-store');
    expect(
      Buffer.from(await preview.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe('%PDF-');

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
    const issuedDetail = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await fetch(`${server.baseUrl}/api/invoices/${invoice.id}`, {
          headers: server.sessionHeaders,
        })
      ).json(),
    );
    expect(issuedDetail.currentRevision).toMatchObject({
      currency: 'EUR',
      functionalCurrency: 'EUR',
      foreignUnitsPerFunctionalUnitNanos: 1_000_000_000,
      functionalNetTotalCents: issuedDetail.currentRevision.netTotalCents,
      functionalVatTotalCents: issuedDetail.currentRevision.vatTotalCents,
      functionalTotalCents: issuedDetail.currentRevision.totalCents,
    });
    const issuedPreview = await fetch(
      `${server.baseUrl}/api/invoices/${invoice.id}/revisions/3/preview`,
      { headers: server.sessionHeaders },
    );
    expect(issuedPreview.status).toBe(200);
    expect(issuedPreview.headers.get('content-disposition')).toBe(
      'inline; filename="preview-facture-FA-2026-000001-v3.pdf"',
    );
    await issuedPreview.arrayBuffer();

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

    const partialPayload = {
      expectedVersion: 3,
      requestId: crypto.randomUUID(),
      amountCents: 100,
      paidOn: '2026-08-20',
      method: 'transfer',
      reference: 'BANK-001',
    };
    const pay = (payload: typeof partialPayload) =>
      fetch(`${server.baseUrl}/api/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify(payload),
      });
    const partial = await pay(partialPayload);
    const forbidden = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/payments`, {
      method: 'POST',
      headers: { ...clientSession, 'content-type': 'application/json' },
      body: JSON.stringify(partialPayload),
    });
    expect(forbidden.status).toBe(403);
    expect(partial.status).toBe(200);
    const portalInvoices = async () => {
      const response = await fetch(`${server.baseUrl}/api/client/invoices`, {
        headers: clientSession,
      });
      expect(response.status).toBe(200);
      return Schema.decodeUnknownSync(ClientInvoiceList)(await response.json());
    };
    expect(await portalInvoices()).toMatchObject([
      {
        id: invoice.id,
        recordedPaidCents: 100,
        remainingCents: invoice.currentRevision.totalCents - 100,
      },
    ]);
    await expect(partial.json()).resolves.toMatchObject({
      status: 'issued',
      payments: [{ amountCents: 100 }],
    });
    expect((await pay(partialPayload)).status).toBe(200);
    expect((await pay({ ...partialPayload, amountCents: 200 })).status).toBe(409);
    expect(
      (
        await pay({
          ...partialPayload,
          requestId: crypto.randomUUID(),
          amountCents: invoice.currentRevision.totalCents,
        })
      ).status,
    ).toBe(409);
    expect(
      (await pay({ ...partialPayload, requestId: crypto.randomUUID(), paidOn: '2099-01-01' }))
        .status,
    ).toBe(409);
    expect(
      (
        await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/void`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: 3 }),
        })
      ).status,
    ).toBe(409);
    const finalPayload = {
      ...partialPayload,
      requestId: crypto.randomUUID(),
      amountCents: invoice.currentRevision.totalCents - 100,
    };
    const paid = await pay(finalPayload);
    expect(paid.status).toBe(200);
    await expect(paid.json()).resolves.toMatchObject({ status: 'paid' });
    expect((await pay(finalPayload)).status).toBe(200);
    expect(await portalInvoices()).toMatchObject([
      { status: 'paid', recordedPaidCents: invoice.currentRevision.totalCents, remainingCents: 0 },
    ]);
    const exportUrl = `${server.baseUrl}/api/invoice-payments/export?from=2026-08-20&to=2026-08-20`;
    const exported = await fetch(exportUrl, { headers: server.sessionHeaders });
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toContain('text/csv');
    expect(exported.headers.get('content-disposition')).toContain('invoice-payments.csv');
    expect(exported.headers.get('cache-control')).toContain('no-store');
    const csv = await exported.text();
    expect(csv).toContain('"BANK-001"');
    expect(csv.split('\r\n')).toHaveLength(4);
    expect((await fetch(exportUrl)).status).toBe(401);
    expect((await fetch(exportUrl, { headers: clientSession })).status).toBe(403);
    const invalidRange = await fetch(
      `${server.baseUrl}/api/invoice-payments/export?from=2026-02-31&to=2026-09-05`,
      { headers: server.sessionHeaders },
    );
    expect(invalidRange.status).toBe(422);
    const voided = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/void`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: 3 }),
    });
    expect(voided.status).toBe(409);

    const paidDetail = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}`, {
      headers: server.sessionHeaders,
    });
    const paidInvoice = Schema.decodeUnknownSync(InvoiceDetail)(await paidDetail.json());
    const payment = paidInvoice.payments[0];
    if (payment === undefined) throw new Error('payment.missing');
    const cancelUrl = `${server.baseUrl}/api/invoices/${invoice.id}/payments/${payment.id}/cancel`;
    const cancelBody = JSON.stringify({
      expectedVersion: paidInvoice.version,
      reason: 'Wrong reference',
    });
    expect(
      (
        await fetch(cancelUrl, {
          method: 'POST',
          headers: { ...clientSession, 'content-type': 'application/json' },
          body: cancelBody,
        })
      ).status,
    ).toBe(403);
    const cancelled = await fetch(cancelUrl, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: cancelBody,
    });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({
      status: 'issued',
      payments: [{ cancellationReason: 'Wrong reference' }, {}],
    });
    expect(
      (await fetch(cancelUrl, { method: 'POST', headers: server.jsonHeaders, body: cancelBody }))
        .status,
    ).toBe(200);
    const correctedExport = await fetch(exportUrl, { headers: server.sessionHeaders });
    const clientBalances = await portalInvoices();
    expect(clientBalances).toMatchObject([
      {
        status: 'issued',
        recordedPaidCents: invoice.currentRevision.totalCents - payment.amountCents,
        remainingCents: payment.amountCents,
      },
    ]);
    expect(JSON.stringify(clientBalances)).not.toContain('Wrong reference');
    expect(JSON.stringify(clientBalances)).not.toContain('BANK-001');
    expect(await correctedExport.text()).toContain('"cancelled"');

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
          "select count(*) from audit_events where action = 'invoice.payment-recorded' and resource_id = ?",
        )
        .pluck()
        .get(invoice.id),
    ).toBe(2);
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

  it('requires and freezes a dated exchange rate for a foreign-currency invoice', async () => {
    await setIssuer(server);
    const client = await createClient(server, 'Foreign invoice client');
    const quote = await createQuote(server, client.id, 'USD');
    const { accepted } = await acceptQuote(server, quote.id);
    const createResponse = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        orderId: accepted.orderId,
        serviceDate: '2026-09-11',
        dueDate: '2026-10-12',
        paymentTerms: 'Payment due within 30 days.',
      }),
    });
    const draft = Schema.decodeUnknownSync(InvoiceDetail)(await createResponse.json());
    const missingRate = await fetch(`${server.baseUrl}/api/invoices/${draft.id}/issue`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: draft.version }),
    });
    expect(missingRate.status).toBe(422);
    await expect(missingRate.json()).resolves.toMatchObject({
      code: 'invoice.exchange_rate_missing',
    });

    const rateResponse = await fetch(`${server.baseUrl}/api/company/exchange-rates`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        rateDate: '2026-09-11',
        foreignCurrency: 'USD',
        foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      }),
    });
    expect(rateResponse.status).toBe(200);
    const issueResponse = await fetch(`${server.baseUrl}/api/invoices/${draft.id}/issue`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ expectedVersion: draft.version }),
    });
    expect(issueResponse.status).toBe(200);
    const issued = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await fetch(`${server.baseUrl}/api/invoices/${draft.id}`, {
          headers: server.sessionHeaders,
        })
      ).json(),
    );
    expect(issued.currentRevision).toMatchObject({
      currency: 'USD',
      functionalCurrency: 'EUR',
      exchangeRateDate: '2026-09-11',
      foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      functionalNetTotalCents: 13_638,
      functionalVatTotalCents: 2_727,
      functionalTotalCents: 16_365,
    });
  });
});
