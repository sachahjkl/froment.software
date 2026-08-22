import { Context } from 'effect';
import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from 'effect/unstable/httpapi';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestInvalidOrigin,
  RequestRateLimited,
  RequestTooLarge,
} from './authentication.js';
import type { Ulid as UlidValue } from './identifiers.js';
import type { PermissionCode as PermissionCodeValue } from './permissions.js';

export type ApiCredentialsValue =
  | { readonly kind: 'session'; readonly token: string }
  | { readonly kind: 'integration-token'; readonly token: string };

export class ApiCredentials extends Context.Service<ApiCredentials, ApiCredentialsValue>()(
  '@froment/contracts/ApiCredentials',
) {}

export class RequiredPermission extends Context.Service<RequiredPermission, PermissionCodeValue>()(
  '@froment/contracts/RequiredPermission',
) {}

export class MutationRateLimit extends Context.Service<MutationRateLimit, number>()(
  '@froment/contracts/MutationRateLimit',
) {}

export type ApiPrincipalValue =
  | {
      readonly userId: UlidValue;
      readonly credential: { readonly kind: 'session'; readonly token: string };
    }
  | {
      readonly userId: UlidValue;
      readonly credential: {
        readonly kind: 'integration-token';
        readonly tokenId: UlidValue;
      };
    };

export class ApiPrincipal extends Context.Service<ApiPrincipal, ApiPrincipalValue>()(
  '@froment/contracts/ApiPrincipal',
) {}

const sessionCookie = HttpApiSecurity.apiKey({
  key: '__Host-froment-session',
  in: 'cookie',
}).pipe(
  HttpApiSecurity.annotateMerge(
    OpenApi.annotations({ description: 'Administrator browser session cookie.' }),
  ),
);

const bearer = HttpApiSecurity.bearer.pipe(
  HttpApiSecurity.annotateMerge(
    OpenApi.annotations({
      description: 'Integration token created in the administrator back office.',
      format: 'froment_it_v1_<token-id>.<secret>',
    }),
  ),
);

export class ApiAuthentication extends HttpApiMiddleware.Service<
  ApiAuthentication,
  { provides: ApiCredentials }
>()('@froment/contracts/ApiAuthentication', {
  requiredForClient: false,
  security: { sessionCookie, bearer },
}) {}

export class ApiAuthorization extends HttpApiMiddleware.Service<
  ApiAuthorization,
  { requires: ApiCredentials; provides: ApiPrincipal }
>()('@froment/contracts/ApiAuthorization', {
  error: [AuthenticationRequired, PermissionDenied, RequestRateLimited],
}) {}

export class ApiWriteProtection extends HttpApiMiddleware.Service<
  ApiWriteProtection,
  { requires: ApiPrincipal }
>()('@froment/contracts/ApiWriteProtection', {
  error: [CsrfRejected, RequestInvalidOrigin, RequestRateLimited, RequestTooLarge],
}) {}
