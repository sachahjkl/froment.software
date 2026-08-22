import {
  formatMoney,
  prepareInvoiceDocument,
  prepareOrderDocument,
  prepareQuoteDocument,
} from '@froment/documents';
import {
  type InvoiceRenderSnapshotValue,
  type OrderRenderSnapshotValue,
  type QuoteRenderSnapshotValue,
} from '@froment/contracts';
import { describe, expect, it } from 'vitest';

const line = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  position: 0,
  description: 'Audit métier',
  quantityMilli: 1_500,
  unitPriceCents: 10_000,
  vatRateBasisPoints: 2_000,
  netTotalCents: 15_000,
  vatTotalCents: 3_000,
  totalCents: 18_000,
};
const issuer = {
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
};
const client = {
  displayName: 'Client Exemple',
  addressLine1: '1 rue du Test',
  addressLine2: '',
  postalCode: '69001',
  city: 'Lyon',
  country: 'France',
  email: 'client@example.test',
};
const quote: QuoteRenderSnapshotValue = {
  templateId: 'quote-default',
  templateVersion: 1,
  quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  quoteReference: 'DE-2026-000001',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  version: 1,
  createdAt: '2026-08-19T23:30:00.000Z',
  issuer,
  client,
  title: 'Audit métier',
  conditions: 'Paiement à 30 jours',
  currency: 'EUR',
  netTotalCents: 15_000,
  vatTotalCents: 3_000,
  totalCents: 18_000,
  lines: [line],
};

describe('Typst document inputs', () => {
  it('formats all business values in TypeScript', () => {
    const input = prepareQuoteDocument(quote);
    expect(input.metadata).toContainEqual(['Date d’émission :', '19 août 2026']);
    expect(input.lines[0]).toEqual({
      position: '1',
      description: 'Audit métier',
      unitPrice: '100,00 €',
      quantity: '1,5',
      vat: '20 %',
      amount: '150,00 €',
    });
    expect(input.totals.at(-1)).toEqual(['Total TTC', '180,00 €']);
  });

  it('prepares separate invoice and order inputs', () => {
    const invoice: InvoiceRenderSnapshotValue = {
      ...quote,
      templateId: 'invoice-default',
      invoiceId: quote.quoteId,
      orderId: quote.revisionId,
      orderReference: 'CO-2026-000001',
      invoiceNumber: null,
      issuedAt: null,
      serviceDate: '2026-08-19',
      dueDate: '2026-09-19',
      paymentTerms: quote.conditions,
    };
    const order: OrderRenderSnapshotValue = {
      ...quote,
      templateId: 'order-default',
      orderId: quote.quoteId,
      orderReference: 'CO-2026-000001',
      confirmedAt: quote.createdAt,
    };
    expect(prepareInvoiceDocument(invoice)).toMatchObject({
      clientHeading: 'Facturé à :',
      termsHeading: 'Conditions de règlement :',
      legal: expect.arrayContaining([expect.stringContaining('L441-10')]),
    });
    expect(prepareOrderDocument(order)).toMatchObject({
      clientHeading: 'Commandé par :',
      title: 'Confirmation de commande · Audit métier',
    });
  });

  it('formats every safe cent integer without precision loss', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'fr-FR', 'EUR')).toBe('90 071 992 547 409,91 €');
  });
});
