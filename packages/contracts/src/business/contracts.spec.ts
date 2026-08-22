import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { InvoiceNumber, OrderReference, QuoteReference, StoredInvoiceNumber } from './contracts.js';

describe('business reference contracts', () => {
  it.each([
    [QuoteReference, 'DE-2026-000001'],
    [OrderReference, 'CO-2026-999999'],
    [InvoiceNumber, 'FA-2026-000001'],
  ])('accepts the exact annual format', (schema, value) => {
    expect(Schema.decodeUnknownSync(schema)(value)).toBe(value);
  });

  it.each(['DE-2026-00001', 'CO-2026-1000000', 'F-000001', 'FA-26-000001'])(
    'rejects %s',
    (value) => {
      expect(() => Schema.decodeUnknownSync(InvoiceNumber)(value)).toThrow();
    },
  );

  it('accepts historical invoice numbers only at persisted document boundaries', () => {
    expect(Schema.decodeUnknownSync(StoredInvoiceNumber)('F-000001')).toBe('F-000001');
  });
});
