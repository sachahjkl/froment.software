import {
  prepareInvoiceDocument,
  prepareOrderDocument,
  prepareQuoteDocument,
  prepareCreditNoteDocument,
} from '@froment/documents';
import {
  type InvoiceRenderSnapshotValue,
  type OrderRenderSnapshotValue,
  type QuoteRenderSnapshotValue,
} from '@froment/contracts';
import { describe, expect, it } from 'vitest';
import { formatMoney } from '@froment/l10n';

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
  phone: '+33 4 12 34 56 78',
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
  it.each([
    ['2026-12-31T23:30:00.000Z', '1 janvier 2027'],
    ['2026-08-19T22:30:00.000Z', '20 août 2026'],
  ])('renders instant dates in the recorded business calendar: %s', (instant, expected) => {
    const calendar = { timeZone: 'Europe/Paris' };
    const datedQuote = { ...quote, createdAt: instant, calendar };
    const datedInvoice: InvoiceRenderSnapshotValue = {
      ...datedQuote,
      templateId: 'invoice-default',
      invoiceId: quote.quoteId,
      orderId: quote.revisionId,
      orderReference: 'CO-2026-000001',
      invoiceNumber: 'FA-2027-000001',
      issuedAt: instant,
      serviceDate: '2026-08-19',
      dueDate: '2027-01-31',
      paymentTerms: '',
    };
    const datedOrder: OrderRenderSnapshotValue = {
      ...datedQuote,
      templateId: 'order-default',
      orderId: quote.quoteId,
      orderReference: 'CO-2026-000001',
      confirmedAt: instant,
    };
    expect(prepareQuoteDocument(datedQuote).metadata).toContainEqual([
      'Date d’émission :',
      expected,
    ]);
    expect(prepareInvoiceDocument(datedInvoice).metadata).toContainEqual([
      'Date d’émission :',
      expected,
    ]);
    expect(prepareOrderDocument(datedOrder).metadata).toContainEqual(['Confirmée le :', expected]);
    expect(prepareInvoiceDocument(datedInvoice).metadata).toContainEqual([
      'Date d’échéance :',
      '31 janvier 2027',
    ]);
    expect(prepareInvoiceDocument(datedInvoice).context).toContain(
      'Date de prestation : 19 août 2026',
    );
    expect(prepareQuoteDocument(datedQuote).client).toContain(client.phone);
    expect(prepareOrderDocument(datedOrder).client).toContain(client.phone);
    expect(prepareInvoiceDocument(datedInvoice).client).toContain(client.phone);
  });

  it('keeps the original invoice date while using the credit note business date', () => {
    const invoice: InvoiceRenderSnapshotValue = {
      ...quote,
      templateId: 'invoice-default',
      invoiceId: quote.quoteId,
      orderId: quote.revisionId,
      orderReference: 'CO-2026-000001',
      invoiceNumber: 'FA-2026-000001',
      issuedAt: '2026-08-19T23:30:00.000Z',
      serviceDate: '2026-08-19',
      dueDate: '2027-01-31',
      paymentTerms: '',
    };
    const input = prepareCreditNoteDocument(
      invoice,
      {
        id: quote.quoteId,
        clientId: quote.clientId,
        status: 'issued',
        version: 1,
        requestId: '00000000-0000-4000-8000-000000000000',
        issueRequestId: '00000000-0000-4000-8000-000000000001',
        number: 'AV-2027-000001',
        reason: 'Annulation',
        currency: quote.currency,
        createdAt: '2026-12-31T23:00:00.000Z',
        createdByUserId: quote.quoteId,
        issuedAt: '2026-12-31T23:30:00.000Z',
        issuedByUserId: quote.quoteId,
        netTotalCents: quote.netTotalCents,
        vatTotalCents: quote.vatTotalCents,
        totalCents: quote.totalCents,
        lines: [
          {
            ...quote.lines[0]!,
            invoiceId: quote.quoteId,
            invoiceVersion: 1,
            invoiceNumber: 'FA-2026-000001',
            sourceLineId: quote.lines[0]!.id,
          },
        ],
        revisions: [
          {
            id: quote.revisionId,
            version: 1,
            reason: 'Annulation',
            createdAt: '2026-12-31T23:00:00.000Z',
            createdByUserId: quote.quoteId,
            netTotalCents: quote.netTotalCents,
            vatTotalCents: quote.vatTotalCents,
            totalCents: quote.totalCents,
            lines: [
              {
                ...quote.lines[0]!,
                invoiceId: quote.quoteId,
                invoiceVersion: 1,
                invoiceNumber: 'FA-2026-000001',
                sourceLineId: quote.lines[0]!.id,
              },
            ],
          },
        ],
      },
      '2027-01-01',
    );
    expect(input.metadata).toContainEqual(['Date d’émission :', '1 janvier 2027']);
    expect(input.metadata).toContainEqual(['Date de la facture d’origine', '19 août 2026']);
  });

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

  it('keeps supplementary Unicode characters intact when wrapping words', () => {
    const title = 'a'.repeat(17) + '😀' + 'b'.repeat(20);
    const input = prepareQuoteDocument({ ...quote, title });
    expect(input.title.isWellFormed()).toBe(true);
    expect(input.title.replaceAll('\u200b', '')).toBe(title);
  });

  it('preserves every milliquantity at the safe integer limit', () => {
    const input = prepareQuoteDocument({
      ...quote,
      lines: [{ ...line, quantityMilli: Number.MAX_SAFE_INTEGER }],
    });
    expect(input.lines[0]?.quantity).toBe('9 007 199 254 740,991');
  });
});
