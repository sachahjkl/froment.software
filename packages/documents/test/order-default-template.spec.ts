import { renderOrderDefaultTemplate } from '@froment/documents';
import { type OrderRenderSnapshotValue } from '@froment/contracts';
import { describe, expect, it } from 'vitest';

const party = {
  displayName: 'Acme',
  addressLine1: '1 rue Test',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  email: 'client@example.test',
};
const snapshot: OrderRenderSnapshotValue = {
  templateId: 'order-default',
  templateVersion: 1,
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  orderReference: 'CO-2026-000001',
  quoteReference: 'DE-2026-000001',
  confirmedAt: '2026-08-20T20:00:00.000Z',
  issuer: {
    ...party,
    displayName: 'Froment Software',
    phone: '',
    registrationNumber: '123',
    vatNumber: 'FR123',
  },
  client: { ...party, displayName: '<script>alert(1)</script> Acme' },
  title: 'Audit',
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

describe('OrderDefaultTemplate', () => {
  it('renders immutable order metadata and escaped content with Cousine', async () => {
    const html = await renderOrderDefaultTemplate(snapshot);
    expect(html).toContain('CO-2026-000001');
    expect(html).toContain('DE-2026-000001');
    expect(html).toContain('120,00&nbsp;€');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Acme');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('font-family: Cousine, "Liberation Mono", monospace');
    expect(html).toMatch(/@page\s*{[^}]*size:\s*A4/);
  });
});
