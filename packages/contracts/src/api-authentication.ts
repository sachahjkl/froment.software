import { Context } from 'effect';
import { HttpApiMiddleware, HttpApiSecurity, OpenApi } from 'effect/unstable/httpapi';

import { RequestRateLimited } from './authentication.js';
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
  error: RequestRateLimited,
}) {}
