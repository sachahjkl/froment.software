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
  });
});
