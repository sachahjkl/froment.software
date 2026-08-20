import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { OrderList } from './orders.js';

describe('order contracts', () => {
  it('validates confirmed order summaries with optional invoices', () => {
    const order = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      clientDisplayName: 'Acme',
      title: 'Accepted quote',
      currency: 'EUR',
      totalCents: 12_000,
      createdAt: '2026-08-20T20:00:00.000Z',
      invoiceId: null,
    };

    expect(Schema.decodeUnknownSync(OrderList)([order])).toEqual([order]);
    expect(
      Schema.decodeUnknownSync(OrderList)([{ ...order, invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ' }]),
    ).toHaveLength(1);
    expect(() => Schema.decodeUnknownSync(OrderList)([{ ...order, totalCents: -1 }])).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OrderList)([{ ...order, createdAt: '2026-08-20' }]),
    ).toThrow();
  });
});
