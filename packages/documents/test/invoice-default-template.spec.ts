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
  templateVersion: 1,
  invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  version: 2,
  createdAt: '2026-08-20T20:00:00.000Z',
  invoiceNumber: 'F-000001',
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
  it('renders the immutable invoice number and escaped client name', async () => {
    const html = await renderInvoiceDefaultTemplate(snapshot);

    expect(html.toLowerCase()).toContain('<!doctype html>');
    expect(html).toContain('F-000001');
    expect(html).toContain('120,00&nbsp;€');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Acme');
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
