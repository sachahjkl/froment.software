import { renderQuoteDefaultTemplate } from '@froment/documents';
import { type QuoteRenderSnapshotValue } from '@froment/contracts';
import { describe, expect, it } from 'vitest';

const snapshot: QuoteRenderSnapshotValue = {
  templateId: 'quote-default',
  templateVersion: 1,
  quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  version: 1,
  createdAt: '2026-08-19T20:00:00.000Z',
  issuer: {
    displayName: 'Froment Software',
    addressLine1: '10 rue du Code',
    addressLine2: '',
    postalCode: '75001',
    city: 'Paris',
    country: 'France',
    email: 'hello@example.test',
    phone: '+33 1 23 45 67 89',
    registrationNumber: '123 456 789 00012',
    vatNumber: 'FR00123456789',
  },
  client: {
    displayName: '<script>alert(1)</script> Acme',
    addressLine1: '1 rue du Test',
    addressLine2: '',
    postalCode: '69001',
    city: 'Lyon',
    country: 'France',
    email: 'client@example.test',
  },
  title: 'Audit métier',
  conditions: 'Paiement à 30 jours',
  currency: 'EUR',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
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

describe('QuoteDefaultTemplate', () => {
  it('renders a complete escaped HTML document', async () => {
    const html = await renderQuoteDefaultTemplate(snapshot);

    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('Froment Software');
    expect(html).toContain('Audit métier');
    expect(html).toContain('120,00&nbsp;€');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Acme');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('"Trebuchet MS", Arial, "Liberation Sans", sans-serif');
    expect(html).not.toContain('Courier');
    expect(html).not.toContain('gradient');
    expect(html).not.toContain('dashed');
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4/);
  });

  it('renders and protects the supported content limits', async () => {
    const unsafeDescription = `<script>alert('line')</script>${'X'.repeat(300)}`;
    const conditions =
      `Conditions <script>alert('conditions')</script> & ${'Y'.repeat(2_000)}`.slice(0, 2_000);
    const boundarySnapshot: QuoteRenderSnapshotValue = {
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
      conditions,
      lines: Array.from({ length: 20 }, (_, position) => ({
        ...snapshot.lines[0]!,
        id: `line-${position}`,
        position,
        description: `${position}-${unsafeDescription}`,
      })),
    };

    const html = await renderQuoteDefaultTemplate(boundarySnapshot);

    expect(conditions).toHaveLength(2_000);
    expect(html.match(/<tr/g)).toHaveLength(21);
    expect(html).toContain(`0-&lt;script&gt;alert('line')&lt;/script&gt;${'X'.repeat(300)}`);
    expect(html).toContain("Conditions &lt;script&gt;alert('conditions')&lt;/script&gt; &amp;");
    expect(html).not.toContain("<script>alert('line')</script>");
    expect(html).toMatch(/table-layout:\s*fixed/);
    expect(html).toMatch(/overflow-wrap:\s*anywhere/);
    expect(html).toMatch(/word-break:\s*break-word/);
    expect(html).toMatch(/break-inside:\s*avoid/);
    expect(html).toMatch(/page-break-inside:\s*avoid/);
    expect(html).toMatch(/thead[^}]*display:\s*table-header-group/);
  });
});
