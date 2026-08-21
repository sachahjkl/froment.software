import {
  InvoiceRenderSnapshot,
  OrderRenderSnapshot,
  QuoteRenderSnapshot,
} from '@froment/contracts';
import { spawnSync } from 'node:child_process';
import { Effect, Schema } from 'effect';
import { chromium, type Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';

import { DocumentRenderer, DocumentRendererLive } from '../src/documents/document-renderer.js';

const longWord = 'W'.repeat(160);
const longText = 'Conditions '.repeat(200).slice(0, 2_000);
const ulidAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ids = Array.from(
  { length: 24 },
  (_, index) => `01ARZ3NDEKTSV4RRFFQ69G5F0${ulidAlphabet[index]}`,
);
const party = {
  displayName: longWord,
  addressLine1: longWord,
  addressLine2: longWord,
  postalCode: '9'.repeat(32),
  city: 'V'.repeat(120),
  country: 'P'.repeat(120),
  email: `${'e'.repeat(150)}@example.test`,
};
const issuer = {
  ...party,
  phone: '1'.repeat(64),
  registrationNumber: '2'.repeat(64),
  vatNumber: '3'.repeat(64),
};
const lines = Array.from({ length: 20 }, (_, position) => ({
  id: ids[position + 4]!,
  position,
  description: longWord,
  quantityMilli: 1_000,
  unitPriceCents: 10_000,
  vatRateBasisPoints: 2_000,
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
}));
const common = {
  templateVersion: 1 as const,
  version: 1,
  createdAt: '2026-08-20T12:00:00.000Z',
  issuer,
  client: party,
  title: 'T'.repeat(120),
  currency: 'EUR' as const,
  netTotalCents: 200_000,
  vatTotalCents: 40_000,
  totalCents: 240_000,
  lines,
};
const quote = Schema.decodeUnknownSync(QuoteRenderSnapshot)({
  ...common,
  templateId: 'quote-default',
  quoteId: ids[0],
  quoteReference: 'DE-2026-000001',
  revisionId: ids[1],
  conditions: longText,
});
const invoice = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
  ...common,
  templateId: 'invoice-default',
  templateVersion: 1,
  invoiceId: ids[2],
  orderId: ids[3],
  orderReference: 'CO-2026-000001',
  quoteReference: 'DE-2026-000001',
  revisionId: ids[1],
  invoiceNumber: 'FA-2026-000001',
  issuedAt: '2026-08-20T12:00:00.000Z',
  serviceDate: '2026-08-20',
  dueDate: '2026-09-20',
  paymentTerms: longText,
});
const compactInvoice = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
  ...invoice,
  issuer: { ...issuer, displayName: 'Froment Software' },
  client: { ...party, displayName: 'Client Exemple' },
  title: 'Développement logiciel',
  paymentTerms: 'Paiement à 30 jours',
  netTotalCents: 60_000,
  vatTotalCents: 12_000,
  totalCents: 72_000,
  lines: lines.slice(0, 6).map((line) => ({ ...line, description: 'Prestation logicielle' })),
});
const compactQuote = Schema.decodeUnknownSync(QuoteRenderSnapshot)({
  ...quote,
  templateVersion: 1,
  quoteReference: 'DE-2026-000001',
  issuer: { ...issuer, displayName: 'Froment Software' },
  client: { ...party, displayName: 'Client Exemple' },
  title: 'Développement logiciel',
  conditions: 'Paiement à 30 jours',
  netTotalCents: 60_000,
  vatTotalCents: 12_000,
  totalCents: 72_000,
  lines: lines.slice(0, 6).map((line) => ({ ...line, description: 'Prestation logicielle' })),
});
const compactOrder = Schema.decodeUnknownSync(OrderRenderSnapshot)({
  templateId: 'order-default',
  templateVersion: 1,
  orderId: ids[3],
  revisionId: ids[1],
  orderReference: 'CO-2026-000001',
  quoteReference: 'DE-2026-000001',
  confirmedAt: '2026-08-20T12:00:00.000Z',
  issuer: compactQuote.issuer,
  client: compactQuote.client,
  title: compactQuote.title,
  conditions: compactQuote.conditions,
  currency: compactQuote.currency,
  netTotalCents: compactQuote.netTotalCents,
  vatTotalCents: compactQuote.vatTotalCents,
  totalCents: compactQuote.totalCents,
  lines: compactQuote.lines,
});

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflows = await page
    .locator('main, header, section, table, th, td, footer')
    .evaluateAll((elements) => {
      const main = elements[0]!.getBoundingClientRect();
      return elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const overflow = element.scrollWidth - element.clientWidth;
        return overflow > 1 || rect.left < main.left - 1 || rect.right > main.right + 1
          ? [
              {
                tag: element.tagName,
                className: element.className,
                overflow,
                left: rect.left,
                right: rect.right,
              },
            ]
          : [];
      });
    });
  expect(overflows).toEqual([]);
};

const expectBusinessLayout = async (page: Page) => {
  const layout = await page.locator('body').evaluate((body) => {
    const style = (selector: string) =>
      body.ownerDocument.defaultView!.getComputedStyle(body.querySelector(selector)!);
    const firstRow = style('tbody tr:nth-child(1)');
    const secondRow = style('tbody tr:nth-child(2)');
    return {
      headerDisplay: style('.header').display,
      metadataBorder: style('.quote-meta').borderTopStyle,
      tableBorder: style('.items tbody').borderBottomStyle,
      cellBorders: ['Top', 'Right', 'Bottom', 'Left'].map((side) =>
        style('tbody td').getPropertyValue(`border-${side.toLowerCase()}-style`),
      ),
      rowColors: [firstRow.backgroundColor, secondRow.backgroundColor],
      totalBorder: style('.grand-total').borderTopStyle,
    };
  });

  expect(layout).toEqual({
    headerDisplay: 'grid',
    metadataBorder: 'solid',
    tableBorder: 'solid',
    cellBorders: ['none', 'none', 'none', 'none'],
    rowColors: ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)'],
    totalBorder: 'double',
  });
};

describe('DocumentRenderer', () => {
  it('prints document templates without horizontal overflow and with embedded text', async () => {
    const rendered = await Effect.runPromise(
      Effect.gen(function* () {
        const renderer = yield* DocumentRenderer;
        return [
          {
            kind: 'quote' as const,
            html: yield* renderer.renderQuote(quote),
            pdf: yield* renderer.renderQuotePdf(quote),
            expectedText: quote.quoteReference,
          },
          {
            kind: 'invoice' as const,
            html: yield* renderer.renderInvoice(invoice),
            pdf: yield* renderer.renderInvoicePdf(invoice),
            expectedText: invoice.invoiceNumber,
          },
        ];
      }).pipe(Effect.provide(DocumentRendererLive), Effect.scoped),
    );
    const browser = await chromium.launch({
      executablePath: process.env['CHROMIUM_PATH'],
      headless: true,
      args: ['--disable-dev-shm-usage'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 794, height: 1_123 });
      await page.emulateMedia({ media: 'print' });
      for (const document of rendered) {
        await page.setContent(document.html, { waitUntil: 'load' });
        await expectNoHorizontalOverflow(page);
        if (document.kind === 'quote') await expectBusinessLayout(page);
        const rows = page.locator('.items tbody tr');
        expect(await rows.count()).toBe(20);
        const terms = page.locator(document.kind === 'quote' ? '.conditions' : '.payment-info');
        expect(await terms.textContent()).toContain(longText);
        const pdfText = Buffer.from(document.pdf).toString('latin1');
        expect(pdfText.startsWith('%PDF-')).toBe(true);
        expect(pdfText.match(/\/Type \/Page\b/g)?.length ?? 0).toBeGreaterThan(1);
        const extracted = spawnSync('pdftotext', ['-', '-'], {
          input: document.pdf,
          encoding: 'utf8',
        });
        expect(extracted.error).toBeUndefined();
        expect(extracted.status).toBe(0);
        expect(extracted.stdout.replaceAll(/\s/g, '')).toContain(document.expectedText);
      }

      await page.setViewportSize({ width: 1_200, height: 1_123 });
      await page.emulateMedia({ media: 'screen' });
      const invoiceDocument = rendered[1];
      if (invoiceDocument === undefined) throw new Error('The rendered invoice is missing.');
      await page.setContent(invoiceDocument.html, { waitUntil: 'load' });
      const invoiceMargins = await page.locator('froment-invoice-document').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.left, element.ownerDocument.documentElement.clientWidth - rect.right];
      });
      const [leftMargin = 0, rightMargin = 0] = invoiceMargins;
      expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(1);

      const compactDocuments = await Effect.runPromise(
        DocumentRenderer.use((service) =>
          Effect.all([
            service
              .renderQuotePdf(compactQuote)
              .pipe(Effect.map((pdf) => ({ kind: 'quote', pdf }))),
            service
              .renderOrderPdf(compactOrder)
              .pipe(Effect.map((pdf) => ({ kind: 'order', pdf }))),
            service
              .renderInvoicePdf(compactInvoice)
              .pipe(Effect.map((pdf) => ({ kind: 'invoice', pdf }))),
          ]),
        ).pipe(Effect.provide(DocumentRendererLive), Effect.scoped),
      );
      for (const document of compactDocuments) {
        const compactPdf = Buffer.from(document.pdf);
        expect(
          compactPdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0,
          document.kind,
        ).toBe(1);
        const fonts = spawnSync('pdffonts', ['-'], { input: compactPdf, encoding: 'utf8' });
        expect(fonts.error).toBeUndefined();
        expect(fonts.status).toBe(0);
        expect(fonts.stdout).toContain('Cousine');
        const extracted = spawnSync('pdftotext', ['-', '-'], {
          input: compactPdf,
          encoding: 'utf8',
        });
        expect(extracted.status).toBe(0);
        expect(extracted.stdout).toContain('Froment Software');
      }
    } finally {
      await browser.close();
    }
  }, 30_000);
});
