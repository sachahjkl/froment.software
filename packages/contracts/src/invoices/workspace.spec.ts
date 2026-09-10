import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  InvoiceReceiptList,
  InvoiceRefundList,
  CreditNoteList,
  InvoiceHistory,
} from './workspace.js';

describe('Invoice workspace contracts', () => {
  it('accepts empty authoritative lists', () => {
    for (const schema of [InvoiceReceiptList, InvoiceRefundList, CreditNoteList, InvoiceHistory]) {
      expect(Schema.is(schema)([])).toBe(true);
    }
  });
  it('accepts 10000 valid rows and rejects 10001 rows for every workspace response', () => {
    const context = {
      invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
      invoiceNumber: 'FA-2026-000001',
      title: 'Invoice',
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      clientDisplayName: 'Client',
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      orderReference: 'CO-2026-000001',
    };
    const entry = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      requestId: '8599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
      amountCents: 1,
      reference: 'BANK',
      recordedAt: '2026-09-01T12:00:00.000Z',
      recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
    };
    const cases = [
      {
        schema: InvoiceReceiptList,
        row: { ...context, ...entry, expectedVersion: 1, paidOn: '2026-09-01', method: 'transfer' },
      },
      {
        schema: InvoiceRefundList,
        row: { ...context, ...entry, refundedOn: '2026-09-01' },
      },
      {
        schema: CreditNoteList,
        row: {
          ...context,
          id: entry.id,
          requestId: entry.requestId,
          invoiceRevisionId: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
          number: 'AV-2026-000001',
          reason: 'Cancelled service',
          issuedAt: entry.recordedAt,
          issuedByUserId: entry.recordedByUserId,
          netTotalCents: 1,
          vatTotalCents: 0,
          totalCents: 1,
        },
      },
      {
        schema: InvoiceHistory,
        row: {
          id: entry.id,
          action: 'invoice.created',
          actorUserId: entry.recordedByUserId,
          resourceType: 'invoice',
          resourceId: context.invoiceId,
          requestId: entry.requestId,
          traceId: null,
          spanId: null,
          occurredAt: entry.recordedAt,
          metadata: {},
        },
      },
    ];
    for (const { schema, row } of cases) {
      const rows = Array.from({ length: 10000 }, () => row);
      expect(Schema.is(schema)(rows)).toBe(true);
      rows.push(row);
      expect(Schema.is(schema)(rows)).toBe(false);
    }
  });
  it('rejects provider acknowledgements as financial receipts', () => {
    expect(
      Schema.is(InvoiceReceiptList)([
        { provider: 'stripe', mode: 'simulation', status: 'accepted', externalId: 'test-receipt' },
      ]),
    ).toBe(false);
  });
  it('requires the invoice, client and order context on receipt rows', () => {
    const payment = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      requestId: '8599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
      expectedVersion: 1,
      amountCents: 100,
      paidOn: '2026-09-01',
      method: 'transfer',
      reference: 'BANK',
      recordedAt: '2026-09-01T12:00:00.000Z',
      recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      cancelledAt: null,
      cancelledByUserId: null,
      cancellationReason: null,
    };
    expect(Schema.is(InvoiceReceiptList)([payment])).toBe(false);
    expect(
      Schema.is(InvoiceReceiptList)([
        {
          ...payment,
          invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
          invoiceNumber: 'FA-2026-000001',
          title: 'Audit',
          clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          clientDisplayName: 'Acme',
          orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          orderReference: 'CO-2026-000001',
        },
      ]),
    ).toBe(true);
  });
});
