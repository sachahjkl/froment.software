import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  PublicQuoteSignatureRequest,
  QuoteCreateRequest,
  QuoteLinkToken,
  QuoteSendRequest,
  QuoteStatus,
} from './quotes.js';

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

  it('validates quote sending inputs', () => {
    expect(Schema.decodeUnknownSync(QuoteSendRequest)({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
    expect(() => Schema.decodeUnknownSync(QuoteSendRequest)({ expectedVersion: 0 })).toThrow();
    expect(
      Schema.decodeUnknownSync(QuoteLinkToken)('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    ).toHaveLength(43);
    expect(() => Schema.decodeUnknownSync(QuoteLinkToken)('not-a-token')).toThrow();
  });

  it('requires bounded signature data and explicit consent', () => {
    const request = {
      token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      signerName: 'Ada Lovelace',
      consent: true,
      signature: { kind: 'typed', value: 'Ada Lovelace' },
    };

    expect(Schema.decodeUnknownSync(PublicQuoteSignatureRequest)(request)).toEqual(request);
    expect(() =>
      Schema.decodeUnknownSync(PublicQuoteSignatureRequest)({ ...request, consent: false }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(PublicQuoteSignatureRequest)({ ...request, signerName: ' ' }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(PublicQuoteSignatureRequest)({
        ...request,
        signature: { kind: 'typed', value: 'x'.repeat(161) },
      }),
    ).toThrow();
  });
});
