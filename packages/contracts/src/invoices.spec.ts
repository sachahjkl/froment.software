import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  InvoiceCreateRequest,
  InvoiceIssueRequest,
  InvoiceNumber,
  InvoiceRevisionCreateRequest,
  InvoiceStatus,
} from './invoices.js';

describe('invoice contracts', () => {
  it('defines the complete invoice state cycle and number format', () => {
    for (const status of ['draft', 'issued', 'paid', 'void']) {
      expect(Schema.decodeUnknownSync(InvoiceStatus)(status)).toBe(status);
    }
    expect(Schema.decodeUnknownSync(InvoiceNumber)('F-000001')).toBe('F-000001');
    expect(() => Schema.decodeUnknownSync(InvoiceNumber)('2026-1')).toThrow();
  });

  it('validates creation, revision, and issue requests', () => {
    const create = {
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      serviceDate: '2026-08-20',
      dueDate: '2026-09-19',
      paymentTerms: 'Payment due in 30 days.',
    };
    expect(Schema.decodeUnknownSync(InvoiceCreateRequest)(create)).toEqual(create);
    expect(() =>
      Schema.decodeUnknownSync(InvoiceCreateRequest)({ ...create, dueDate: '19/09/2026' }),
    ).toThrow();
    expect(Schema.decodeUnknownSync(InvoiceIssueRequest)({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
    expect(() => Schema.decodeUnknownSync(InvoiceIssueRequest)({ expectedVersion: 0 })).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(InvoiceRevisionCreateRequest)({
        expectedVersion: 1,
        title: 'Invoice',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        paymentTerms: '',
        lines: [],
      }),
    ).toThrow();
  });
});
