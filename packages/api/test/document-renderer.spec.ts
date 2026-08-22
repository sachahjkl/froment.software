import {
  InvoiceRenderSnapshot,
  OrderRenderSnapshot,
  QuoteRenderSnapshot,
} from '@froment/contracts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigProvider, Effect, Layer, Schema } from 'effect';
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
const maximumOrder = Schema.decodeUnknownSync(OrderRenderSnapshot)({
  ...compactOrder,
  issuer,
  client: party,
  title: common.title,
  conditions: longText,
  lines,
  netTotalCents: common.netTotalCents,
  vatTotalCents: common.vatTotalCents,
  totalCents: common.totalCents,
});

const inspectPdf = (pdf: Uint8Array) => {
  const info = spawnSync('pdfinfo', ['-'], { input: pdf, encoding: 'utf8' });
  const text = spawnSync('pdftotext', ['-layout', '-', '-'], { input: pdf, encoding: 'utf8' });
  const fonts = spawnSync('pdffonts', ['-'], { input: pdf, encoding: 'utf8' });
  expect(info.status).toBe(0);
  expect(text.status).toBe(0);
  expect(fonts.status).toBe(0);
  expect(info.stdout).toMatch(/Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/);
  expect(fonts.stdout).toMatch(/Cousine-Bold\s+CID TrueType\s+Identity-H\s+yes\s+yes\s+yes/);
  return { info: info.stdout, text: text.stdout };
};

const expectVisualReference = (kind: 'quote' | 'invoice' | 'order', pdf: Uint8Array): void => {
  const directory = mkdtempSync(join(tmpdir(), 'froment-pdf-reference-'));
  try {
    const output = join(directory, 'page');
    const rasterized = spawnSync(
      'pdftoppm',
      ['-f', '1', '-l', '1', '-singlefile', '-r', '96', '-mono', '-', output],
      { input: pdf },
    );
    expect(rasterized.status).toBe(0);
    const raster = readFileSync(`${output}.pbm`);
    const path = new URL(`./references/${kind}-compact.pbm`, import.meta.url);
    if (process.env['UPDATE_PDF_REFERENCES'] === 'true') writeFileSync(path, raster);
    const reference = readFileSync(path);
    const changedBytes = raster.reduce(
      (count, value, index) => count + (value === reference[index] ? 0 : 1),
      Math.abs(raster.byteLength - reference.byteLength),
    );
    const tolerance = 0;
    expect(changedBytes / Math.max(raster.byteLength, reference.byteLength)).toBeLessThanOrEqual(
      tolerance,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

describe('DocumentRenderer', () => {
  it('renders compact and maximum fixtures as stable A4 PDFs with embedded text', async () => {
    const rendered = await Effect.runPromise(
      DocumentRenderer.use((renderer) =>
        Effect.all([
          renderer.renderQuotePdf(compactQuote),
          renderer.renderInvoicePdf(compactInvoice),
          renderer.renderOrderPdf(compactOrder),
          renderer.renderQuotePdf(quote),
          renderer.renderInvoicePdf(invoice),
          renderer.renderOrderPdf(maximumOrder),
        ]),
      ).pipe(Effect.provide(DocumentRendererLive)),
    );
    const compactKinds = ['quote', 'invoice', 'order'] as const;
    for (const [index, pdf] of rendered.slice(0, 3).entries()) {
      const inspected = inspectPdf(pdf!);
      expect(inspected.info).toMatch(/Pages:\s+1\b/);
      expect(inspected.text).toContain('Froment Software');
      expectVisualReference(compactKinds[index]!, pdf!);
    }
    for (const pdf of rendered.slice(3)) {
      const inspected = inspectPdf(pdf!);
      expect(Number(inspected.info.match(/Pages:\s+(\d+)/)?.[1])).toBeGreaterThan(1);
      expect(inspected.text.replaceAll(/\s/g, '')).toContain(longText.replaceAll(/\s/g, '').trim());
      expect(inspected.text.match(/Désignation/g)?.length).toBeGreaterThan(1);
      for (let position = 1; position <= 20; position += 1) {
        expect(inspected.text).toMatch(new RegExp(`^\\s*${position}\\s`, 'm'));
      }
    }
  }, 30_000);

  it('produces identical bytes for identical inputs', async () => {
    const [first, second] = await Effect.runPromise(
      DocumentRenderer.use((renderer) =>
        Effect.all([renderer.renderQuotePdf(compactQuote), renderer.renderQuotePdf(compactQuote)]),
      ).pipe(Effect.provide(DocumentRendererLive)),
    );
    expect(first).toEqual(second);
  });

  it('returns a redacted typed error and removes temporary files after compiler failure', async () => {
    const before = readdirSync(tmpdir())
      .filter((name) => name.startsWith('froment-pdf-'))
      .sort();
    const config = ConfigProvider.fromUnknown({
      TYPST_PATH: '/missing/typst',
      DOCUMENT_TEMPLATES_PATH: process.env['DOCUMENT_TEMPLATES_PATH'],
      DOCUMENT_FONTS_PATH: process.env['DOCUMENT_FONTS_PATH'],
    });
    const rendererLayer = DocumentRendererLive.pipe(Layer.provide(ConfigProvider.layer(config)));
    const result = await Effect.runPromise(
      Effect.result(
        DocumentRenderer.use((renderer) => renderer.renderQuotePdf(compactQuote)).pipe(
          Effect.provide(rendererLayer),
        ),
      ),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: { _tag: 'DocumentRenderError', reason: 'compiler' },
    });
    expect(JSON.stringify(result)).not.toContain('/missing/typst');
    expect(
      readdirSync(tmpdir())
        .filter((name) => name.startsWith('froment-pdf-'))
        .sort(),
    ).toEqual(before);
  });
});
