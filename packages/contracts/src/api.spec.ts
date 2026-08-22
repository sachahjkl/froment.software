import { Schema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';

import { Api, RevisionVersionParameter } from './api.js';

describe('API contracts', () => {
  it('accepts only positive safe route versions', () => {
    expect(Schema.decodeUnknownSync(RevisionVersionParameter)('1')).toBe(1);
    expect(
      Schema.decodeUnknownSync(RevisionVersionParameter)(String(Number.MAX_SAFE_INTEGER)),
    ).toBe(Number.MAX_SAFE_INTEGER);

    for (const version of ['0', '-1', '1.5', '9007199254740992', '9007199254740993']) {
      expect(() => Schema.decodeUnknownSync(RevisionVersionParameter)(version)).toThrow();
    }
  });

  it('publishes only the integration API contract', () => {
    const specification = OpenApi.fromApi(Api);

    expect(specification.openapi).toBe('3.1.0');
    expect(specification.info).toMatchObject({
      title: 'Froment Software Integration API',
      version: 'latest',
    });
    expect(Object.keys(specification.paths).sort()).toEqual([
      '/api/clients',
      '/api/clients/{clientId}',
      '/api/clients/{clientId}/archive',
      '/api/clients/{clientId}/reactivate',
      '/api/invoices',
      '/api/invoices/{invoiceId}',
      '/api/invoices/{invoiceId}/issue',
      '/api/invoices/{invoiceId}/mark-paid',
      '/api/invoices/{invoiceId}/revisions',
      '/api/invoices/{invoiceId}/revisions/{version}/pdf',
      '/api/invoices/{invoiceId}/void',
      '/api/orders',
      '/api/orders/{orderId}/pdf',
      '/api/quotes',
      '/api/quotes/{quoteId}',
      '/api/quotes/{quoteId}/cancel',
      '/api/quotes/{quoteId}/revisions',
      '/api/quotes/{quoteId}/revisions/{version}/pdf',
      '/api/quotes/{quoteId}/send',
    ]);
    expect(specification.paths['/api/auth/login']).toBeUndefined();
    expect(specification.paths['/api/integration-tokens']).toBeUndefined();
    expect(specification.paths['/api/public/quote-link']).toBeUndefined();
    expect(specification.components.securitySchemes).toMatchObject({
      bearer: { type: 'http', scheme: 'Bearer' },
      sessionCookie: { type: 'apiKey', in: 'cookie', name: '__Host-froment-session' },
    });
    expect(specification.paths['/api/clients']?.get?.security).toEqual([
      { sessionCookie: [] },
      { bearer: [] },
    ]);
    expect(specification.paths['/api/quotes/{quoteId}/cancel']?.post).toMatchObject({
      description: expect.stringContaining('Required permission: `quote.delete`.'),
      'x-required-permission': 'quote.delete',
    });
    expect(specification.paths['/api/quotes/{quoteId}/cancel']?.post?.responses).toHaveProperty(
      '413',
    );
  });
});
