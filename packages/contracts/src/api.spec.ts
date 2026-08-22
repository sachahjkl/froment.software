import { Context, Option, Schema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';

import { RevisionVersionParameter } from './api-common.js';
import { Api } from './api.js';
import { RequiredPermissions } from './api-policy/permissions.js';
import { EndpointRateLimit } from './api-policy/rate-limit.js';
import { IntegrationPermissionCodes } from './permissions.js';

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
    expect(specification.info).toMatchObject({ version: 'latest' });
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
      'x-required-permissions': ['quote.delete'],
    });
    expect(specification.paths['/api/quotes/{quoteId}/cancel']?.post?.responses).toHaveProperty(
      '413',
    );
    expect(specification.paths['/api/clients']?.get?.responses).not.toHaveProperty('413');
    const documentedPermissions = new Set(
      Object.values(specification.paths).flatMap((path) =>
        Object.values(path).flatMap((operation) => {
          if (typeof operation !== 'object' || operation === null) return [];
          const permissions = (
            operation as typeof operation & {
              readonly 'x-required-permissions'?: ReadonlyArray<string>;
            }
          )['x-required-permissions'];
          return permissions ?? [];
        }),
      ),
    );
    expect([...documentedPermissions].sort()).toEqual([...IntegrationPermissionCodes].sort());
  });

  it('keeps permissions, mutation quotas, and frontend visibility independent', () => {
    const clientAccess = Api.groups.clients.endpoints.clientAccessCreate;
    const affairEvents = Api.groups.affairs.endpoints.affairEventList;
    const tokenCreate = Api.groups.integrationTokens.endpoints.integrationTokenCreate;

    expect(
      Option.getOrUndefined(Context.getOption(clientAccess.annotations, RequiredPermissions)),
    ).toEqual(['client.access.create']);
    expect(
      Option.getOrUndefined(Context.getOption(clientAccess.annotations, EndpointRateLimit)),
    ).toBe(10);
    expect(
      Option.getOrUndefined(Context.getOption(affairEvents.annotations, RequiredPermissions)),
    ).toEqual(['quote.read', 'audit.read']);
    expect(
      Option.getOrUndefined(Context.getOption(tokenCreate.annotations, RequiredPermissions)),
    ).toEqual(['integration-token.manage']);
    expect(
      Option.getOrUndefined(Context.getOption(tokenCreate.annotations, EndpointRateLimit)),
    ).toBe(10);
  });
});
