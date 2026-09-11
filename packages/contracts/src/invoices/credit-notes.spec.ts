import { Schema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';
import {
  Api,
  InvoiceCreditConflict,
  InvoiceCreditFailure,
  InvoiceCreditRequestConflict,
} from '../index.js';

describe('credit conflict contracts', () => {
  it.each([
    new InvoiceCreditConflict({ code: 'invoice.credit_conflict' }),
    new InvoiceCreditRequestConflict({ code: 'invoice.credit_request_conflict' }),
  ])('preserves $code through the public decoder', (failure) => {
    const encoded = Schema.encodeSync(InvoiceCreditFailure)(failure);
    expect(Schema.decodeUnknownSync(InvoiceCreditFailure)(encoded)).toEqual(failure);
  });

  it('declares both conflicts as HTTP 409 responses on all three mutation endpoints', () => {
    const specification = OpenApi.fromApi(Api);
    for (const path of [
      '/api/invoices/{invoiceId}/credits',
      '/api/invoices/{invoiceId}/refunds',
      '/api/invoices/{invoiceId}/refunds/{refundId}/cancel',
    ]) {
      expect(specification.paths[path]?.post?.responses['409']).toMatchObject({
        content: {
          'application/json': {
            schema: {
              anyOf: expect.arrayContaining([
                { $ref: '#/components/schemas/InvoiceCreditConflictEncoded' },
                { $ref: '#/components/schemas/InvoiceCreditRequestConflictEncoded' },
              ]),
            },
          },
        },
      });
    }
  });

  it('rejects mismatched conflict tags and codes', () => {
    expect(() =>
      Schema.decodeUnknownSync(InvoiceCreditFailure)({
        _tag: 'InvoiceCreditConflict',
        code: 'invoice.credit_request_conflict',
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(InvoiceCreditFailure)({
        _tag: 'InvoiceCreditRequestConflict',
        code: 'invoice.credit_conflict',
      }),
    ).toThrow();
  });
});
