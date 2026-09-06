import { Context, Option, Schema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';

import { RevisionVersionParameter } from './api-common.js';
import { Api } from './api.js';
import { ApiAuthorization } from './api-authentication.js';
import { PermissionCodes } from './permissions.js';
import { RequiredPermissions } from './api-policy/permissions.js';
import { EndpointRateLimit } from './api-policy/rate-limit.js';
import { ApiTokenPermissionCodes } from './permissions.js';

describe('API contracts', () => {
  it('requires authorization middleware and documented registered permissions on every business endpoint', () => {
    const dedicatedPolicies = new Set([
      'health',
      'teamInvitationAccept',
      'version',
      'bootstrapStatus',
      'bootstrapCreate',
      'login',
      'refresh',
      'logout',
      'currentAccount',
      'passwordChange',
      'passkeyList',
      'passkeyRegisterOptions',
      'passkeyRegisterVerify',
      'passkeyRemove',
      'passkeyLoginOptions',
      'passkeyLoginVerify',
      'accountSessionList',
      'accountSessionRevoke',
      'publicQuoteGet',
      'publicQuotePdfDownload',
      'publicQuoteSign',
      'clientQuoteList',
      'clientOrderList',
      'clientInvoiceList',
      'clientQuotePdf',
      'clientOrderPdf',
      'clientInvoicePdf',
    ]);
    const spec = OpenApi.fromApi(Api);
    const operations = Object.values(spec.paths).flatMap((path) => Object.values(path));
    for (const group of Object.values(Api.groups)) {
      for (const endpoint of Object.values(group.endpoints)) {
        const required = Context.getOption(endpoint.annotations, RequiredPermissions);
        if (dedicatedPolicies.has(endpoint.identifier)) {
          expect(Option.isNone(required), endpoint.identifier).toBe(true);
          continue;
        }
        expect(Option.isSome(required), endpoint.identifier).toBe(true);
        if (Option.isNone(required)) continue;
        expect(endpoint.middlewares.has(ApiAuthorization), endpoint.identifier).toBe(true);
        expect(required.value.every((permission) => PermissionCodes.includes(permission))).toBe(
          true,
        );
        expect(
          operations.find((operation) => operation?.operationId === endpoint.identifier),
        ).toMatchObject({
          'x-required-permissions': [...required.value],
        });
      }
    }
  });
  it('accepts only positive safe route versions', () => {
    expect(Schema.decodeUnknownSync(RevisionVersionParameter)('1')).toBe(1);
    expect(
      Schema.decodeUnknownSync(RevisionVersionParameter)(String(Number.MAX_SAFE_INTEGER)),
    ).toBe(Number.MAX_SAFE_INTEGER);

    for (const version of ['0', '-1', '1.5', '9007199254740992', '9007199254740993']) {
      expect(() => Schema.decodeUnknownSync(RevisionVersionParameter)(version)).toThrow();
    }
  });

  it('publishes the complete API contract', () => {
    const specification = OpenApi.fromApi(Api);

    expect(specification.openapi).toBe('3.1.0');
    expect(specification.info).toMatchObject({ version: 'latest' });
    expect(specification.paths['/api/auth/login']?.post?.tags).toEqual([
      'authentication',
      'frontend',
    ]);
    expect(specification.paths['/api/tokens']?.get?.tags).toEqual(['apiTokens', 'frontend']);
    expect(specification.paths['/api/public/quote-link']?.post?.tags).toEqual([
      'quoteLinks',
      'frontend',
    ]);
    expect(specification.paths['/api/health']?.get?.tags).toEqual(['status']);
    expect(specification.components.securitySchemes).toMatchObject({
      bearer: { type: 'http', scheme: 'bearer' },
    });
    expect(specification.components.securitySchemes).not.toHaveProperty('sessionCookie');
    expect(specification.paths['/api/clients']?.get?.security).toEqual([{ bearer: [] }]);
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
    expect(ApiTokenPermissionCodes.every((code) => documentedPermissions.has(code))).toBe(true);
  });

  it('keeps permissions, mutation quotas, and frontend visibility independent', () => {
    const clientAccess = Api.groups.clients.endpoints.clientAccessCreate;
    const affairEvents = Api.groups.affairs.endpoints.affairEventList;
    const tokenCreate = Api.groups.apiTokens.endpoints.apiTokenCreate;

    expect(
      Option.getOrUndefined(Context.getOption(clientAccess.annotations, RequiredPermissions)),
    ).toEqual(['client.access.manage']);
    expect(
      Option.getOrUndefined(Context.getOption(clientAccess.annotations, EndpointRateLimit)),
    ).toBe(10);
    expect(
      Option.getOrUndefined(Context.getOption(affairEvents.annotations, RequiredPermissions)),
    ).toEqual(['quote.read', 'audit.read']);
    expect(
      Option.getOrUndefined(Context.getOption(tokenCreate.annotations, RequiredPermissions)),
    ).toEqual(['api-token.manage']);
    expect(
      Option.getOrUndefined(Context.getOption(tokenCreate.annotations, EndpointRateLimit)),
    ).toBe(10);
  });
});
