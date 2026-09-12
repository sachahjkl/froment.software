import {
  CreditNote,
  InvoiceCredits,
  InvoiceDetail,
  InvoiceList,
  ClientInvoiceList,
} from '@froment/contracts';
import { DateTime, Schema } from 'effect';
import { invoiceIssueDate } from './invoices.js';
import Sqlite from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createClientSession,
  createQuote,
  setIssuer,
  startHttpTestServer,
} from '../server/server.spec-helper.js';

it('issues one immutable full credit, preserves PDFs, stops collection, and records bounded refunds without external effects', async () => {
  const server = await startHttpTestServer();
  const sqlite = new Sqlite(server.databaseFilename);
  const post = (path: string, body: typeof Schema.Json.Type) =>
    fetch(`${server.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...server.jsonHeaders, origin: server.baseUrl },
      body: JSON.stringify(body),
    });
  const get = (path: string) =>
    fetch(`${server.baseUrl}${path}`, { headers: server.sessionHeaders });
  try {
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
    expect(
      (
        await post('/api/credit-notes', {
          requestId: randomUUID(),
          reason: 'Draft',
          lines: draft.currentRevision.lines.map((line) => ({
            invoiceId: draft.id,
            invoiceVersion: draft.version,
            sourceLineId: line.id,
            quantityMilli: line.quantityMilli,
          })),
        })
      ).status,
    ).toBe(409);
    expect((await post(`${path}/issue`, { expectedVersion: draft.version })).status).toBe(200);
    let invoice = Schema.decodeUnknownSync(InvoiceDetail)(await (await get(path)).json());
    const targetQuote = await createQuote(server, client.id);
    const { accepted: targetOrder } = await acceptQuote(server, targetQuote.id);
    const targetDraft = Schema.decodeUnknownSync(InvoiceDetail)(
      await (
        await post('/api/invoices', {
          orderId: targetOrder.orderId,
          serviceDate: '2026-09-01',
          dueDate: '2027-01-01',
          paymentTerms: '30 days',
        })
      ).json(),
    );
    const targetPath = `/api/invoices/${targetDraft.id}`;
    expect(
      (await post(`${targetPath}/issue`, { expectedVersion: targetDraft.version })).status,
    ).toBe(200);
    const paymentRequest = {
      requestId: randomUUID(),
      expectedVersion: invoice.version,
      amountCents: 10000,
      paidOn: '2026-09-06',
      method: 'transfer',
      reference: 'RECEIPT',
    };
    invoice = Schema.decodeUnknownSync(InvoiceDetail)(
      await (await post(`${path}/payments`, paymentRequest)).json(),
    );
    expect((await post(`${path}/revisions/${invoice.version}/pdf`, {})).status).toBe(200);
    const originalPdf = Buffer.from(
      await (await get(`${path}/revisions/${invoice.version}/pdf`)).arrayBuffer(),
    );
    const initialRevisions = invoice.revisions;
    const request = {
      requestId: randomUUID(),
      reason: '<script>Service cancelled</script>',
      lines: invoice.currentRevision.lines.map((line) => ({
        invoiceId: invoice.id,
        invoiceVersion: invoice.version,
        sourceLineId: line.id,
        quantityMilli: line.quantityMilli,
      })),
    };
    const response = await post('/api/credit-notes', request);
    expect(response.status).toBe(200);
    const draftNote = Schema.decodeUnknownSync(CreditNote)(await response.json());
    const issueRequest = { requestId: randomUUID(), expectedVersion: draftNote.version };
    const issueResponse = await post(`/api/credit-notes/${draftNote.id}/issue`, issueRequest);
    expect(issueResponse.status).toBe(200);
    const state = Schema.decodeUnknownSync(InvoiceCredits)(
      await (await get(`${path}/credits`)).json(),
    );
    expect(state.creditNotes[0]).toMatchObject({
      totalCents: invoice.currentRevision.totalCents,
      netTotalCents: invoice.currentRevision.netTotalCents,
      vatTotalCents: invoice.currentRevision.vatTotalCents,
    });
    expect(state.refundableCents).toBe(10000);
    const issuedNote = state.creditNotes[0];
    if (issuedNote === undefined) throw new Error('credit.test.note_missing');
    const issuedAt = issuedNote.issuedAt;
    if (issuedAt === null) throw new Error('credit.test.note_missing');
    const allocationRequest = {
      requestId: randomUUID(),
      targetInvoiceId: targetDraft.id,
      amountCents: 4000,
      allocatedOn: invoiceIssueDate(
        Date.parse(issuedAt),
        DateTime.zoneMakeNamedUnsafe('Europe/Paris'),
      ),
      reference: 'CREDIT-ALLOCATION',
    };
    const allocated = Schema.decodeUnknownSync(InvoiceCredits)(
      await (await post(`${path}/credit-allocations`, allocationRequest)).json(),
    );
    const allocation = allocated.allocations[0];
    if (allocation === undefined) throw new Error('credit.test.allocation_missing');
    expect(allocated.refundableCents).toBe(6000);
    expect(allocation).toMatchObject(allocationRequest);
    const cancellation = { reason: 'Wrong target invoice' };
    const cancelled = Schema.decodeUnknownSync(InvoiceCredits)(
      await (await post(`${path}/credit-allocations/${allocation.id}/cancel`, cancellation)).json(),
    );
    expect(cancelled.refundableCents).toBe(10000);
    expect(cancelled.allocations[0]).toMatchObject({
      id: allocation.id,
      cancellationReason: cancellation.reason,
    });
    expect(
      (await post(`${path}/credit-allocations/${allocation.id}/cancel`, cancellation)).status,
    ).toBe(200);
    expect(
      (
        await post(`${path}/credit-allocations/${allocation.id}/cancel`, {
          reason: 'Changed',
        })
      ).status,
    ).toBe(409);
    expect(() =>
      sqlite
        .prepare('update invoice_credit_allocations set cancellation_reason = ?')
        .run('Changed'),
    ).toThrow('database.trigger.invoice_credit_allocations_immutable_update');
    expect(
      sqlite
        .prepare(
          "select count(*) from audit_events where action = 'invoice.credit-allocation-cancelled'",
        )
        .pluck()
        .get(),
    ).toBe(1);
    expect(
      Schema.decodeUnknownSync(InvoiceCredits)(await (await get(`${path}/credits`)).json()),
    ).toEqual(cancelled);
    expect((await post('/api/credit-notes', { ...request, reason: 'Changed' })).status).toBe(409);
    expect((await post('/api/credit-notes', { ...request, requestId: randomUUID() })).status).toBe(
      409,
    );
    expect(
      (
        await post(`${path}/payments`, {
          ...paymentRequest,
          requestId: randomUUID(),
          amountCents: 1,
        })
      ).status,
    ).toBe(409);
    expect((await post(`${path}/void`, { expectedVersion: invoice.version })).status).toBe(409);
    expect(
      (
        await fetch(`${server.baseUrl}/api/reminders/${randomUUID()}`, {
          method: 'PUT',
          headers: { ...server.jsonHeaders, origin: server.baseUrl },
          body: JSON.stringify({
            invoiceId: draft.id,
            expectedVersion: invoice.version,
            expectedMode: 'simulation',
            language: 'fr',
            sendAt: new Date(Date.now() + 86400000).toISOString(),
          }),
        })
      ).status,
    ).toBe(409);
    const note = issuedNote;
    const pdfResponse = await get(`/api/credit-notes/${note.id}/pdf`);
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get('content-disposition')).toContain('AV-2026-000001.pdf');
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.equals(originalPdf)).toBe(false);
    expect(
      Buffer.from(await (await get(`/api/credit-notes/${note.id}/pdf`)).arrayBuffer()),
    ).toEqual(pdf);
    expect(
      Buffer.from(await (await get(`${path}/revisions/${invoice.version}/pdf`)).arrayBuffer()),
    ).toEqual(originalPdf);
    expect(Schema.decodeUnknownSync(InvoiceDetail)(await (await get(path)).json())).toMatchObject({
      creditedCents: invoice.currentRevision.totalCents,
      version: invoice.version,
      revisions: initialRevisions,
    });
    expect(
      Schema.decodeUnknownSync(InvoiceList)(await (await get('/api/invoices')).json())[0]
        ?.creditedCents,
    ).toBe(invoice.currentRevision.totalCents);
    const clientHeaders = await createClientSession(server, client.id);
    const portal = Schema.decodeUnknownSync(ClientInvoiceList)(
      await (
        await fetch(`${server.baseUrl}/api/client/invoices`, { headers: clientHeaders })
      ).json(),
    );
    expect(portal[0]).toMatchObject({
      creditedCents: invoice.currentRevision.totalCents,
      remainingCents: 0,
      recordedPaidCents: 10000,
    });
    expect(
      (
        await fetch(`${server.baseUrl}/api/client/credit-notes/${note.id}/pdf`, {
          headers: clientHeaders,
        })
      ).status,
    ).toBe(200);
    const stranger = await createClient(server);
    const strangerHeaders = await createClientSession(server, stranger.id);
    expect(
      (
        await fetch(`${server.baseUrl}/api/client/credit-notes/${note.id}/pdf`, {
          headers: strangerHeaders,
        })
      ).status,
    ).toBe(409);
    const refund = {
      requestId: randomUUID(),
      amountCents: 6000,
      refundedOn: invoiceIssueDate(
        Date.parse(issuedAt),
        DateTime.zoneMakeNamedUnsafe('Europe/Paris'),
      ),
      reference: 'REFUND',
    };
    expect((await post(`${path}/refunds`, { ...refund, refundedOn: '2099-01-01' })).status).toBe(
      409,
    );
    expect((await post(`${path}/refunds`, { ...refund, refundedOn: '2026-09-05' })).status).toBe(
      409,
    );
    const outcomes = await Promise.all([
      post(`${path}/refunds`, refund),
      post(`${path}/refunds`, { ...refund, requestId: randomUUID() }),
    ]);
    expect(outcomes.map((response) => response.status).sort()).toEqual([200, 409]);
    const current = Schema.decodeUnknownSync(InvoiceCredits)(
      await (await get(`${path}/credits`)).json(),
    );
    expect(current.refundableCents).toBe(4000);
    const payment = invoice.payments[0];
    const recorded = current.refunds[0];
    if (!payment || !recorded) throw new Error('credit.test.record_missing');
    const retryRefund = { ...refund, requestId: recorded.requestId };
    expect((await post(`${path}/refunds`, retryRefund)).status).toBe(200);
    expect(
      (
        await post(`${path}/payments/${payment.id}/cancel`, {
          expectedVersion: invoice.version,
          reason: 'Wrong receipt',
        })
      ).status,
    ).toBe(409);
    expect(
      (await post(`${path}/refunds/${recorded.id}/cancel`, { reason: 'Wrong refund record' }))
        .status,
    ).toBe(200);
    expect(
      Schema.decodeUnknownSync(InvoiceCredits)(await (await get(`${path}/credits`)).json())
        .refundableCents,
    ).toBe(10000);
    expect((await post(`${path}/refunds`, retryRefund)).status).toBe(200);
    expect(
      Schema.decodeUnknownSync(InvoiceCredits)(await (await get(`${path}/credits`)).json())
        .refundableCents,
    ).toBe(10000);
    expect(
      (
        await post(`${path}/payments/${payment.id}/cancel`, {
          expectedVersion: invoice.version,
          reason: 'Wrong receipt',
        })
      ).status,
    ).toBe(200);
    expect(
      Schema.decodeUnknownSync(InvoiceCredits)(await (await get(`${path}/credits`)).json())
        .refundableCents,
    ).toBe(0);
    expect(sqlite.prepare('select count(*) from integration_operations').pluck().get()).toBe(0);
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([]);
    expect(() =>
      sqlite.prepare('update invoice_credit_notes set reason = ?').run('Changed'),
    ).toThrow('credit_note_immutable');
    expect(() => sqlite.prepare('delete from invoice_credit_notes').run()).toThrow(
      'credit_note_immutable',
    );
    expect(() =>
      sqlite.prepare('update invoice_credit_note_artifacts set sha256 = ?').run('0'.repeat(64)),
    ).toThrow('credit_note_artifacts_update');
    expect(sqlite.prepare('select sha256 from invoice_credit_note_artifacts').pluck().get()).toBe(
      createHash('sha256').update(pdf).digest('hex'),
    );
  } finally {
    sqlite.close();
    await server.close();
  }
}, 30000);
