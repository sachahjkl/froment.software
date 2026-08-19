import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { QuoteCreateRequest, QuoteStatus } from './quotes.js';

const line = {
  description: 'Development',
  quantityMilli: 1_000,
  unitPriceCents: 10_000,
  vatRateBasisPoints: 2_000,
};

describe('quote contracts', () => {
  it('defines the complete status cycle', () => {
    for (const status of ['draft', 'sent', 'accepted', 'rejected', 'expired']) {
      expect(Schema.decodeUnknownSync(QuoteStatus)(status)).toBe(status);
    }
  });

  it('validates quote and line bounds', () => {
    const valid = {
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      title: 'Website',
      conditions: '',
      lines: [line],
    };
    expect(Schema.decodeUnknownSync(QuoteCreateRequest)(valid).lines).toHaveLength(1);
    expect(() => Schema.decodeUnknownSync(QuoteCreateRequest)({ ...valid, lines: [] })).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteCreateRequest)({ ...valid, title: ' '.repeat(121) }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteCreateRequest)({
        ...valid,
        lines: [{ ...line, quantityMilli: 0 }],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteCreateRequest)({
        ...valid,
        lines: [{ ...line, vatRateBasisPoints: 10_001 }],
      }),
    ).toThrow();
  });
});
