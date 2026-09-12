import {
  InvoiceDetail,
  QuoteConditionPreset,
  QuoteDetail,
  parseDocumentText,
  serializeDocumentText,
} from '@froment/contracts';
import Sqlite from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { Schema } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptQuote,
  createClient,
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('formatted document conditions', () => {
  let server: HttpTestServer;
  beforeAll(async () => {
    server = await startHttpTestServer();
    await setIssuer(server);
  }, 30_000);
  afterAll(async () => server.close());

  it('stores presentation with revisions, carries it to orders and preserves published data', async () => {
    const conditions = serializeDocumentText(
      parseDocumentText(
        '## Conditions particulières\n\nPaiement **à réception**.\n\n- Première clause\n- Deuxième clause',
      ),
    );
    const presentation = { format: 'blocks', placement: 'new-page' } as const;
    const createdPreset = await fetch(`${server.baseUrl}/api/quote-condition-presets`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        name: 'Conditions structurées',
        conditions,
        conditionsPresentation: presentation,
      }),
    });
    expect(createdPreset.status).toBe(200);
    const preset = Schema.decodeUnknownSync(QuoteConditionPreset)(await createdPreset.json());
    expect(preset.conditionsPresentation).toEqual(presentation);
    const client = await createClient(server);
    const created = await fetch(`${server.baseUrl}/api/quotes`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        clientId: client.id,
        currency: 'EUR',
        title: 'Prestation avec conditions',
        conditions: preset.conditions,
        conditionsPresentation: preset.conditionsPresentation,
        lines: [
          {
            description: 'Prestation',
            quantityMilli: 1000,
            unitPriceCents: 10000,
            vatRateBasisPoints: 0,
          },
        ],
      }),
    });
    expect(created.status).toBe(200);
    const quote = Schema.decodeUnknownSync(QuoteDetail)(await created.json());
    expect(quote.currentRevision.conditionsPresentation).toEqual(presentation);
    const { accepted } = await acceptQuote(server, quote.id);
    const orderPreview = await fetch(`${server.baseUrl}/api/orders/${accepted.orderId}/preview`, {
      headers: server.sessionHeaders,
    });
    expect(orderPreview.status).toBe(200);
    const pdf = spawnSync('pdftotext', ['-layout', '-', '-'], {
      input: Buffer.from(await orderPreview.arrayBuffer()),
      encoding: 'utf8',
    });
    expect(pdf.status).toBe(0);
    expect(
      pdf.stdout.split('\f').findIndex((page) => page.includes('Conditions particulières')),
    ).toBe(1);
    const update = await fetch(`${server.baseUrl}/api/quote-condition-presets/${preset.id}`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        name: preset.name,
        conditions: serializeDocumentText(parseDocumentText('Autres conditions')),
        conditionsPresentation: { ...presentation, placement: 'inline' },
      }),
    });
    expect(update.status).toBe(200);
    const detailResponse = await fetch(`${server.baseUrl}/api/quotes/${quote.id}`, {
      headers: server.sessionHeaders,
    });
    const detail = Schema.decodeUnknownSync(QuoteDetail)(await detailResponse.json());
    expect(detail.currentRevision.conditions).toBe(conditions);
    expect(detail.currentRevision.conditionsPresentation).toEqual(presentation);

    const invoiceResponse = await fetch(`${server.baseUrl}/api/invoices`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        orderId: accepted.orderId,
        serviceDate: '2026-09-11',
        dueDate: '2026-10-11',
        paymentTerms: serializeDocumentText(parseDocumentText('**Sous trente jours**')),
        paymentTermsPresentation: presentation,
      }),
    });
    expect(invoiceResponse.status).toBe(200);
    const invoice = Schema.decodeUnknownSync(InvoiceDetail)(await invoiceResponse.json());
    const database = new Sqlite(server.databaseFilename);
    try {
      const savedQuote = database
        .prepare('select render_snapshot from quote_revisions where id = ?')
        .pluck()
        .get(quote.currentRevision.id);
      const savedInvoice = database
        .prepare('select render_snapshot from invoice_revisions where id = ?')
        .pluck()
        .get(invoice.currentRevision.id);
      const issue = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}/issue`, {
        method: 'POST',
        headers: server.jsonHeaders,
        body: JSON.stringify({ expectedVersion: 1 }),
      });
      expect(issue.status).toBe(200);
      await issue.json();
      const issuedResponse = await fetch(`${server.baseUrl}/api/invoices/${invoice.id}`, {
        headers: server.sessionHeaders,
      });
      const issued = Schema.decodeUnknownSync(InvoiceDetail)(await issuedResponse.json());
      expect(issued.currentRevision.paymentTerms).toBe(
        serializeDocumentText(parseDocumentText('**Sous trente jours**')),
      );
      expect(issued.currentRevision.paymentTermsPresentation).toEqual(presentation);
      expect(
        database
          .prepare('select render_snapshot from quote_revisions where id = ?')
          .pluck()
          .get(quote.currentRevision.id),
      ).toBe(savedQuote);
      expect(
        database
          .prepare('select render_snapshot from invoice_revisions where id = ?')
          .pluck()
          .get(invoice.currentRevision.id),
      ).toBe(savedInvoice);
      expect(() =>
        database
          .prepare('update quote_revisions set conditions_presentation = null where id = ?')
          .run(quote.currentRevision.id),
      ).toThrow('published_quote_revisions_immutable_update');
      expect(() =>
        database
          .prepare('update invoice_revisions set payment_terms_presentation = null where id = ?')
          .run(issued.currentRevision.id),
      ).toThrow('invoice_revisions_no_update');
    } finally {
      database.close();
    }
  }, 30_000);
});
