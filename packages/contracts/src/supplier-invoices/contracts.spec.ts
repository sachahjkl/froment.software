import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { SupplierInvoiceCreateRequest } from './contracts.js';

const request = {
  requestId: '97b85b47-577a-44db-b62a-5c0c7622b461',
  supplierId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  reference: 'SUP-2026-42',
  invoiceDate: '2026-09-01',
  dueDate: '2026-10-01',
  currency: 'EUR',
  lines: [{ description: 'Service', netTotalCents: 10_000, vatRateBasisPoints: 2_000 }],
  notes: '',
  source: 'manual',
  sourceFileName: null,
  externalSubmissionId: null,
};

describe('supplier invoice contracts', () => {
  it('accepts a dated invoice with one purchase line', () => {
    expect(Schema.is(SupplierInvoiceCreateRequest)(request)).toBe(true);
  });
  it('rejects empty lines and a due date before the invoice date', () => {
    expect(Schema.is(SupplierInvoiceCreateRequest)({ ...request, lines: [] })).toBe(false);
    expect(Schema.is(SupplierInvoiceCreateRequest)({ ...request, dueDate: '2026-08-31' })).toBe(
      false,
    );
  });
});
