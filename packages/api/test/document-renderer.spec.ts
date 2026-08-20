import { InvoiceRenderSnapshot, QuoteRenderSnapshot } from '@froment/contracts';
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
  revisionId: ids[1],
  conditions: longText,
});
const invoice = Schema.decodeUnknownSync(InvoiceRenderSnapshot)({
  ...common,
  templateId: 'invoice-default',
  invoiceId: ids[2],
  orderId: ids[3],
  revisionId: ids[1],
  invoiceNumber: 'F-000001',
  issuedAt: '2026-08-20T12:00:00.000Z',
  serviceDate: '2026-08-20',
  dueDate: '2026-09-20',
  paymentTerms: longText,
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

describe('DocumentRenderer', () => {
  it('prints maximal quote and invoice templates without horizontal overflow', async () => {
    const rendered = await Effect.runPromise(
      Effect.gen(function* () {
        const renderer = yield* DocumentRenderer;
        return [
          {
            html: yield* renderer.renderQuote(quote),
            pdf: yield* renderer.renderQuotePdf(quote),
            expectedText: quote.quoteId,
          },
          {
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
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setViewportSize({ width: 794, height: 1_123 });
      await page.emulateMedia({ media: 'print' });
      for (const document of rendered) {
        await page.setContent(document.html, { waitUntil: 'load' });
        await expectNoHorizontalOverflow(page);
        expect(await page.locator('tbody tr').count()).toBe(20);
        expect(await page.locator('.conditions').textContent()).toContain(longText);
        const pdfText = Buffer.from(document.pdf).toString('latin1');
        expect(pdfText.startsWith('%PDF-')).toBe(true);
        expect(pdfText.match(/\/Type \/Page\b/g)?.length ?? 0).toBeGreaterThan(1);
        const extracted = spawnSync('pdftotext', ['-', '-'], {
          input: document.pdf,
          encoding: 'utf8',
        });
        expect(extracted.error).toBeUndefined();
        expect(extracted.status).toBe(0);
        expect(extracted.stdout).toContain(document.expectedText);
      }
    } finally {
      await browser.close();
    }
  }, 30_000);
});
