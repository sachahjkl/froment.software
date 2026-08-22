import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AccessToken,
  AuthenticationRequired,
  AuthenticationRateLimited,
  AuthenticationRejected,
  CurrentAccount,
  LoginRequest,
  SessionRejected,
} from './contracts.js';
import { ApiAuthentication } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { Permissions } from '../permissions.js';
import { Ulid } from '../identifiers.js';

export class AuthenticationApi extends HttpApiGroup.make('authentication', { topLevel: true }).add(
  HttpApiEndpoint.post('login', '/api/auth/login', {
    payload: LoginRequest,
    success: AccessToken,
    error: [
      AuthenticationRejected.pipe(HttpApiSchema.status(401)),
      AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('refresh', '/api/auth/refresh', {
    success: AccessToken,
    error: SessionRejected.pipe(HttpApiSchema.status(401)),
  })
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
  HttpApiEndpoint.get('currentAccount', '/api/auth/account', {
    success: CurrentAccount,
    error: AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  })
    .middleware(ApiAuthentication)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('logout', '/api/auth/logout', {
    success: HttpApiSchema.NoContent,
    error: SessionRejected.pipe(HttpApiSchema.status(401)),
  })
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('accountSessionsRevoke', '/api/auth/accounts/:userId/revoke-sessions', {
    params: { userId: Ulid },
    success: HttpApiSchema.NoContent,
  }).pipe(requirePermissions([Permissions.clientAccessCreate]), authenticate, frontendSpecific),
) {}
