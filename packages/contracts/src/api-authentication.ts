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

export class RequiredPermissions extends Context.Service<
  RequiredPermissions,
  readonly [PermissionCodeValue, ...ReadonlyArray<PermissionCodeValue>]
>()('@froment/contracts/RequiredPermissions') {}

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
  error: AuthenticationRequired,
}) {}

export class ApiBrowserRequest extends HttpApiMiddleware.Service<ApiBrowserRequest>()(
  '@froment/contracts/ApiBrowserRequest',
  { error: RequestInvalidOrigin },
) {}

export class ApiRequestBody extends HttpApiMiddleware.Service<ApiRequestBody>()(
  '@froment/contracts/ApiRequestBody',
  { error: RequestTooLarge },
) {}

export class ApiAuthorization extends HttpApiMiddleware.Service<
  ApiAuthorization,
  { requires: ApiCredentials; provides: ApiPrincipal }
>()('@froment/contracts/ApiAuthorization', {
  error: [
    AuthenticationRequired,
    PermissionDenied,
    CsrfRejected,
    RequestInvalidOrigin,
    RequestRateLimited,
  ],
}) {}
