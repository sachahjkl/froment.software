import { renderInvoiceDefaultTemplate } from '@froment/documents';
import { type InvoiceRenderSnapshotValue } from '@froment/contracts';
import { describe, expect, it } from 'vitest';

const party = {
  displayName: 'Froment Software',
  addressLine1: '10 rue du Code',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  email: 'hello@example.test',
};

const snapshot: InvoiceRenderSnapshotValue = {
  templateId: 'invoice-default',
  templateVersion: 2,
  invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  orderReference: 'CO-2026-000001',
  quoteReference: 'DE-2026-000001',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  version: 2,
  createdAt: '2026-08-20T20:00:00.000Z',
  invoiceNumber: 'FA-2026-000001',
  issuedAt: '2026-08-20T20:00:00.000Z',
  serviceDate: '2026-08-20',
  dueDate: '2026-09-19',
  issuer: { ...party, phone: '', registrationNumber: '123', vatNumber: 'FR00123' },
  client: { ...party, displayName: '<script>alert(1)</script> Acme' },
  title: 'Audit métier',
  paymentTerms: 'Paiement à 30 jours',
  currency: 'EUR',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      position: 0,
      description: 'Audit',
      quantityMilli: 1_000,
      unitPriceCents: 10_000,
      vatRateBasisPoints: 2_000,
      netTotalCents: 10_000,
      vatTotalCents: 2_000,
      totalCents: 12_000,
    },
  ],
};

describe('InvoiceDefaultTemplate', () => {
  it('keeps the historical template for version 1 snapshots', async () => {
    const html = await renderInvoiceDefaultTemplate({
      ...snapshot,
      templateVersion: 1,
      invoiceNumber: 'F-000001',
    });

    expect(html).toContain('F-000001');
    expect(html).toContain('class="document-header"');
    expect(html).toContain('"Trebuchet MS", Arial, "Liberation Sans", sans-serif');
    expect(html).not.toContain('font-family: Cousine');
  });

  it('renders the immutable invoice number and escaped client name', async () => {
    const html = await renderInvoiceDefaultTemplate(snapshot);

    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('FA-2026-000001');
    expect(html).toContain('CO-2026-000001');
    expect(html).toContain('120,00&nbsp;€');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Acme');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('font-family: Cousine, "Liberation Mono", monospace');
    expect(html).toMatch(/froment-invoice-document[^{]*{[^}]*margin-inline:\s*auto/);
    expect(html).not.toContain('@import');
    expect(html).not.toContain('font-toolbar');
    expect(html).not.toContain('fontPicker');
    expect(html).not.toContain('gradient');
    expect(html).not.toContain('dashed');
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4/);
    expect(html).toMatch(/\.header[^{]*{[^}]*display:\s*grid/);
    expect(html).toMatch(/\.invoice-meta[^{]*{[^}]*border:\s*0\.25mm solid/);
    expect(html).toMatch(/\.items[^{]*thead[^{]*{[^}]*border-bottom:\s*0\.25mm solid/);
    expect(html).toMatch(/\.grand-total[^{]*{[^}]*border-top:\s*1mm double/);
  });

  it('renders and protects the supported content limits', async () => {
    const unsafeDescription = `<script>alert('line')</script>${'X'.repeat(300)}`;
    const paymentTerms = `Paiement <script>alert('terms')</script> & ${'Y'.repeat(2_000)}`.slice(
      0,
      2_000,
    );
    const boundarySnapshot: InvoiceRenderSnapshotValue = {
      ...snapshot,
      issuer: {
        ...snapshot.issuer,
        displayName: 'SOCIETE'.repeat(30),
        addressLine1: '10 '.concat('RUE-SANS-ESPACE'.repeat(30)),
      },
      client: {
        ...snapshot.client,
        displayName: 'CLIENT'.repeat(35),
        addressLine1: '1 '.concat('ADRESSE-SANS-ESPACE'.repeat(30)),
      },
      paymentTerms,
      lines: Array.from({ length: 20 }, (_, position) => ({
        ...snapshot.lines[0]!,
        id: `line-${position}`,
        position,
        description: `${position}-${unsafeDescription}`,
      })),
    };

    const html = await renderInvoiceDefaultTemplate(boundarySnapshot);

    expect(paymentTerms).toHaveLength(2_000);
    expect(html.match(/<td[^>]*class="position"/g)).toHaveLength(20);
    expect(html).toContain(`0-&lt;script&gt;alert('line')&lt;/script&gt;${'X'.repeat(300)}`);
    expect(html).toContain("Paiement &lt;script&gt;alert('terms')&lt;/script&gt; &amp;");
    expect(html).not.toContain("<script>alert('line')</script>");
    expect(html).toMatch(/table-layout:\s*fixed/);
    expect(html).toMatch(/overflow-wrap:\s*anywhere/);
    expect(html).toMatch(/word-break:\s*break-word/);
    expect(html).toMatch(/break-inside:\s*avoid/);
    expect(html).toMatch(/page-break-inside:\s*avoid/);
    expect(html).toMatch(/thead[^}]*display:\s*table-header-group/);
  });
});
