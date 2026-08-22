import { Context } from 'effect';
import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from 'effect/unstable/httpapi';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestInvalidOrigin,
  RequestRateLimited,
  RequestTooLarge,
} from './authentication/contracts.js';
import type { Ulid as UlidValue } from './identifiers.js';

export type ApiCredentialsValue =
  | { readonly kind: 'access-token'; readonly token: string }
  | { readonly kind: 'api-token'; readonly token: string };

export class ApiCredentials extends Context.Service<ApiCredentials, ApiCredentialsValue>()(
  '@froment/contracts/ApiCredentials',
) {}

export type ApiPrincipalValue =
  | {
      readonly userId: UlidValue;
      readonly credential: { readonly kind: 'access-token'; readonly sessionId: UlidValue };
    }
  | {
      readonly userId: UlidValue;
      readonly credential: {
        readonly kind: 'api-token';
        readonly tokenId: UlidValue;
      };
    };

export class ApiPrincipal extends Context.Service<ApiPrincipal, ApiPrincipalValue>()(
  '@froment/contracts/ApiPrincipal',
) {}

const bearer = HttpApiSecurity.bearer.pipe(
  HttpApiSecurity.annotateMerge(
    OpenApi.annotations({
      format: 'froment_api_v1_<token-id>.<secret>',
    }),
  ),
);

export class ApiAuthentication extends HttpApiMiddleware.Service<
  ApiAuthentication,
  { provides: ApiCredentials }
>()('@froment/contracts/ApiAuthentication', {
  requiredForClient: false,
  security: { bearer },
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
  error: [AuthenticationRequired, PermissionDenied, RequestInvalidOrigin, RequestRateLimited],
}) {}
