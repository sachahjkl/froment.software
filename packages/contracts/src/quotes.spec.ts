import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  PublicQuoteSignatureRequest,
  QuoteCreateRequest,
  QuoteLinkToken,
  QuoteLine,
  QuoteRenderSnapshot,
  QuoteRevision,
  QuoteSendRequest,
  QuoteSendResult,
  QuoteSummary,
  QuoteStatus,
} from './quotes.js';

const line = {
  description: 'Development',
  quantityMilli: 1_000,
  unitPriceCents: 10_000,
  vatRateBasisPoints: 2_000,
};

const calculatedLine = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  position: 0,
  ...line,
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
};

const party = {
  displayName: 'Froment Software',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
};

const snapshot = {
  templateId: 'quote-default',
  templateVersion: 1,
  quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  version: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  issuer: { ...party, phone: '', registrationNumber: '', vatNumber: '' },
  client: party,
  title: 'Website',
  conditions: '',
  currency: 'EUR',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  lines: [calculatedLine],
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
    expect(
      Schema.decodeUnknownSync(QuoteCreateRequest)({
        ...valid,
        lines: Array.from({ length: 20 }, () => line),
      }).lines,
    ).toHaveLength(20);
    expect(() =>
      Schema.decodeUnknownSync(QuoteCreateRequest)({
        ...valid,
        lines: Array.from({ length: 21 }, () => line),
      }),
    ).toThrow();
  });

  it('validates line calculations with BigInt arithmetic', () => {
    expect(Schema.decodeUnknownSync(QuoteLine)(calculatedLine)).toEqual(calculatedLine);
    for (const field of ['netTotalCents', 'vatTotalCents', 'totalCents'] as const) {
      expect(() =>
        Schema.decodeUnknownSync(QuoteLine)({ ...calculatedLine, [field]: 1 }),
      ).toThrow();
    }

    const largeLine = {
      ...calculatedLine,
      quantityMilli: 1,
      unitPriceCents: Number.MAX_SAFE_INTEGER,
      vatRateBasisPoints: 0,
      netTotalCents: 9_007_199_254_741,
      vatTotalCents: 0,
      totalCents: 9_007_199_254_741,
    };
    expect(Schema.decodeUnknownSync(QuoteLine)(largeLine)).toEqual(largeLine);
  });

  it('validates snapshot aggregates, positions, identifiers, and line count', () => {
    expect(Schema.decodeUnknownSync(QuoteRenderSnapshot)(snapshot)).toEqual(snapshot);
    for (const field of ['netTotalCents', 'vatTotalCents', 'totalCents'] as const) {
      expect(() =>
        Schema.decodeUnknownSync(QuoteRenderSnapshot)({ ...snapshot, [field]: 1 }),
      ).toThrow();
    }

    const lineIds = '0123456789ABCDEFGHJK';
    const lines = Array.from({ length: 20 }, (_, position) => ({
      ...calculatedLine,
      id: `01ARZ3NDEKTSV4RRFFQ69G5F${lineIds[position]}0`,
      position,
    }));
    const boundary = {
      ...snapshot,
      netTotalCents: 200_000,
      vatTotalCents: 40_000,
      totalCents: 240_000,
      lines,
    };
    expect(Schema.decodeUnknownSync(QuoteRenderSnapshot)(boundary).lines).toHaveLength(20);
    expect(() =>
      Schema.decodeUnknownSync(QuoteRenderSnapshot)({
        ...boundary,
        netTotalCents: 210_000,
        vatTotalCents: 42_000,
        totalCents: 252_000,
        lines: [...lines, { ...lines[0], position: 20 }],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteRenderSnapshot)({
        ...snapshot,
        lines: [{ ...calculatedLine, position: 1 }],
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteRenderSnapshot)({
        ...boundary,
        lines: [lines[0], { ...lines[1], id: lines[0]!.id }, ...lines.slice(2)],
      }),
    ).toThrow();
  });

  it('accepts only real canonical UTC timestamps', () => {
    for (const createdAt of [
      '2026-99-99T99:99:99.999Z',
      '2026-08-20T10:00:00.000+02:00',
      '2026-08-20T08:00:00Z',
    ]) {
      expect(() =>
        Schema.decodeUnknownSync(QuoteRenderSnapshot)({ ...snapshot, createdAt }),
      ).toThrow();
    }
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

  it('validates generated quote links as HTTP URLs', () => {
    const link = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      url: 'https://example.com/quotes/token',
      expiresAt: '2026-08-20T20:00:00.000Z',
    };

    expect(Schema.decodeUnknownSync(QuoteSendResult.fields.link)(link)).toEqual(link);
    for (const url of ['https://?', 'ftp://example.com/quotes/token']) {
      expect(() =>
        Schema.decodeUnknownSync(QuoteSendResult.fields.link)({ ...link, url }),
      ).toThrow();
    }
  });

  it('rejects blank client names in quote responses', () => {
    expect(() => Schema.decodeUnknownSync(QuoteRevision.fields.clientDisplayName)('   ')).toThrow();
    expect(() => Schema.decodeUnknownSync(QuoteSummary.fields.clientDisplayName)('   ')).toThrow();
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
