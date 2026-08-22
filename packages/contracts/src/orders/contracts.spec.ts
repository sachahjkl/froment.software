import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  OrderDocumentArtifact,
  OrderList,
  OrderRenderSnapshot,
  OrderSummary,
} from './contracts.js';

describe('order contracts', () => {
  it('validates confirmed order summaries with optional invoices', () => {
    const order = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      reference: 'CO-2026-000001',
      quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      quoteReference: 'DE-2026-000001',
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
    expect(() => Schema.decodeUnknownSync(OrderSummary.fields.clientDisplayName)('   ')).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(OrderList)([{ ...order, createdAt: '2026-08-20' }]),
    ).toThrow();
  });

  it('validates immutable render snapshots and PDF artifacts', () => {
    const party = {
      displayName: 'Acme',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
    };
    const snapshot = {
      templateId: 'order-default',
      templateVersion: 1,
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      orderReference: 'CO-2026-000001',
      quoteReference: 'DE-2026-000001',
      confirmedAt: '2026-08-20T20:00:00.000Z',
      issuer: { ...party, phone: '', registrationNumber: '', vatNumber: '' },
      client: party,
      title: 'Audit',
      conditions: '',
      currency: 'EUR',
      netTotalCents: 100,
      vatTotalCents: 20,
      totalCents: 120,
      lines: [
        {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          position: 0,
          description: 'Audit',
          quantityMilli: 1_000,
          unitPriceCents: 100,
          vatRateBasisPoints: 2_000,
          netTotalCents: 100,
          vatTotalCents: 20,
          totalCents: 120,
        },
      ],
    };
    expect(Schema.decodeUnknownSync(OrderRenderSnapshot)(snapshot)).toEqual(snapshot);
    expect(() =>
      Schema.decodeUnknownSync(OrderRenderSnapshot)({ ...snapshot, totalCents: 121 }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(OrderDocumentArtifact)({
        id: snapshot.orderId,
        orderId: snapshot.orderId,
        orderReference: snapshot.orderReference,
        kind: 'order-pdf',
        contentType: 'application/pdf',
        byteSize: 1,
        sha256: 'a'.repeat(64),
        createdAt: snapshot.confirmedAt,
      }),
    ).toBeDefined();
  });
});
