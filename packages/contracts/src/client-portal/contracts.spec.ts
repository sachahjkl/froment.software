import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { ClientInvoiceList, ClientOrderList, ClientQuoteList } from './contracts.js';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('client portal contracts', () => {
  it('validates client-safe document lists', () => {
    expect(
      Schema.decodeUnknownSync(ClientQuoteList)([
        {
          id,
          reference: 'DE-2026-000001',
          status: 'sent',
          title: 'Audit',
          currency: 'EUR',
          totalCents: 1_200,
          updatedAt: '2026-08-20T08:00:00.000Z',
          pdfAvailable: true,
        },
      ]),
    ).toHaveLength(1);
    expect(
      Schema.decodeUnknownSync(ClientOrderList)([
        {
          id,
          reference: 'CO-2026-000001',
          quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          quoteReference: 'DE-2026-000001',
          status: 'confirmed',
          title: 'Audit',
          currency: 'EUR',
          totalCents: 1_200,
          createdAt: '2026-08-20T08:00:00.000Z',
          invoiceId: null,
          pdfAvailable: false,
        },
      ]),
    ).toHaveLength(1);
    expect(
      Schema.decodeUnknownSync(ClientInvoiceList)([
        {
          id,
          orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          orderReference: 'CO-2026-000001',
          status: 'issued',
          invoiceNumber: 'FA-2026-000001',
          title: 'Audit',
          dueDate: '2026-09-20',
          currency: 'EUR',
          totalCents: 1_200,
          updatedAt: '2026-08-20T08:00:00.000Z',
          pdfAvailable: false,
        },
      ]),
    ).toHaveLength(1);
  });

  it('excludes tenant and revision fields', () => {
    const [quote] = Schema.decodeUnknownSync(ClientQuoteList)([
      {
        id,
        reference: 'DE-2026-000001',
        clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        status: 'sent',
        title: 'Quote',
        currency: 'EUR',
        totalCents: 0,
        updatedAt: '2026-08-20T08:00:00.000Z',
        pdfAvailable: false,
      },
    ]);

    expect(quote).not.toHaveProperty('clientId');
    expect(quote).not.toHaveProperty('revisionId');
  });

  it('rejects impossible client invoice dates', () => {
    const invoice = {
      id,
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      orderReference: 'CO-2026-000001',
      status: 'issued',
      invoiceNumber: 'FA-2026-000001',
      title: 'Audit',
      dueDate: '2026-02-31',
      currency: 'EUR',
      totalCents: 1_200,
      updatedAt: '2026-08-20T08:00:00.000Z',
      pdfAvailable: false,
    };

    expect(() => Schema.decodeUnknownSync(ClientInvoiceList)([invoice])).toThrow();
  });
});
