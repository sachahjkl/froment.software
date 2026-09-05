import { ClientSummary, InvoiceDetail } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  createQuote,
  renderQuotePdf,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('document publication checks', () => {
  let server: HttpTestServer;
  beforeAll(async () => (server = await startHttpTestServer()), 30_000);
  afterAll(async () => server.close());

  it('blocks incomplete snapshots and refreshes invoice parties only on request', async () => {
    const issuer = await setIssuer(server);
    const incompleteIssuer = { ...issuer, addressLine1: '', email: 'invalid' };
    const setIncompleteIssuer = () =>
      fetch(`${server.baseUrl}/api/issuer-settings`, {
        method: 'PUT',
        headers: server.jsonHeaders,
        body: JSON.stringify(incompleteIssuer),
      });
    expect((await setIncompleteIssuer()).status).toBe(200);
    const client = await createClient(server);
    const quote = await createQuote(server, client.id);
    await renderQuotePdf(server, quote.id);
    const send = () =>
      fetch(`${server.baseUrl}/api/quotes/${quote.id}/send`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 1 }),
      });
    const rejected = await send();
    expect(rejected.status).toBe(409);
    await expect(rejected.json()).resolves.toMatchObject({
      code: 'document.incomplete',
      issues: [
        { party: 'issuer', field: 'addressLine1', reason: 'required' },
        { party: 'issuer', field: 'email', reason: 'invalid_email' },
      ],
    });
    const database = new Sqlite(server.databaseFilename, { readonly: true });
    try {
      expect(database.prepare('select count(*) from quote_links').pluck().get()).toBe(0);
      expect(database.prepare('select status from quotes where id = ?').pluck().get(quote.id)).toBe(
        'draft',
      );
      const originalQuote = database
        .prepare('select render_snapshot from quote_revisions where quote_id = ? and version = 1')
        .pluck()
        .get(quote.id);
      await setIssuer(server);
      expect((await send()).status).toBe(409);
      const quoteRevision = await fetch(`${server.baseUrl}/api/quotes/${quote.id}/revisions`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          expectedVersion: 1,
          title: 'Complete quote',
          conditions: '',
          lines: quote.currentRevision.lines,
        }),
      });
      expect(quoteRevision.status).toBe(200);
      const { accepted } = await acceptQuote(server, quote.id, 2);
      expect(
        database
          .prepare('select render_snapshot from quote_revisions where quote_id = ? and version = 1')
          .pluck()
          .get(quote.id),
      ).toBe(originalQuote);

      expect((await setIncompleteIssuer()).status).toBe(200);
      const created = await fetch(`${server.baseUrl}/api/invoices`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          orderId: accepted.orderId,
          serviceDate: '2026-08-20',
          dueDate: '2099-09-19',
          paymentTerms: '',
        }),
      });
      expect(created.status).toBe(200);
      let invoice = Schema.decodeUnknownSync(InvoiceDetail)(await created.json());
      const issue = () =>
        fetch(`${server.baseUrl}/api/invoices/${invoice.id}/issue`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({ expectedVersion: invoice.version }),
        });
      const originalInvoice = database
        .prepare(
          'select render_snapshot from invoice_revisions where invoice_id = ? and version = 1',
        )
        .pluck()
        .get(invoice.id);
      const denied = await issue();
      expect(denied.status).toBe(409);
      await expect(denied.json()).resolves.toMatchObject({ code: 'document.incomplete' });
      expect(
        database
          .prepare('select invoice_number from invoices where id = ?')
          .pluck()
          .get(invoice.id),
      ).toBe(null);
      expect(database.prepare('select count(*) from invoice_pdf_jobs').pluck().get()).toBe(0);
      expect(
        database
          .prepare("select count(*) from audit_events where action = 'invoice.issued'")
          .pluck()
          .get(),
      ).toBe(0);

      await setIssuer(server);
      const clientResponse = await fetch(`${server.baseUrl}/api/clients/${client.id}`, {
        headers: server.sessionHeaders,
      });
      const currentClient = Schema.decodeUnknownSync(ClientSummary)(await clientResponse.json());
      const corrected = await fetch(`${server.baseUrl}/api/clients/${client.id}`, {
        method: 'PUT',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          ...currentClient,
          displayName: 'Corrected client',
          expectedUpdatedAt: currentClient.updatedAt,
        }),
      });
      expect(corrected.status).toBe(200);

      for (const refreshParties of [false, true]) {
        const revision = invoice.currentRevision;
        const response = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/revisions`, {
          method: 'POST',
          headers: server.jsonHeaders,
          body: JSON.stringify({
            expectedVersion: invoice.version,
            refreshParties,
            title: revision.title,
            serviceDate: revision.serviceDate,
            dueDate: revision.dueDate,
            paymentTerms: revision.paymentTerms,
            lines: revision.lines,
          }),
        });
        expect(response.status).toBe(200);
        invoice = Schema.decodeUnknownSync(InvoiceDetail)(await response.json());
        expect(invoice.currentRevision.clientDisplayName).toBe(
          refreshParties ? 'Corrected client' : client.displayName,
        );
        expect((await issue()).status).toBe(refreshParties ? 200 : 409);
      }
      expect(
        database
          .prepare(
            'select render_snapshot from invoice_revisions where invoice_id = ? and version = 1',
          )
          .pluck()
          .get(invoice.id),
      ).toBe(originalInvoice);
      expect(database.prepare('select count(*) from invoice_pdf_jobs').pluck().get()).toBe(1);
      expect(
        database
          .prepare("select count(*) from audit_events where action = 'invoice.issued'")
          .pluck()
          .get(),
      ).toBe(1);
    } finally {
      database.close();
    }
  }, 20_000);
});
