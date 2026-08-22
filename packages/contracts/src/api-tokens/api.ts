import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import {
  ApiTokenCreateRequest,
  ApiTokenCreated,
  ApiTokenInvalidCursor,
  ApiTokenInvalidExpiration,
  ApiTokenListQuery,
  ApiTokenNameConflict,
  ApiTokenNotFound,
  ApiTokenPage,
} from '../api-tokens/contracts.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';

export class ApiTokensApi extends HttpApiGroup.make('apiTokens', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('apiTokenList', '/api/tokens', {
    query: ApiTokenListQuery,
    success: ApiTokenPage,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      ApiTokenInvalidCursor.pipe(HttpApiSchema.status(400)),
    ],
  }).pipe(requirePermissions([Permissions.apiTokenManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('apiTokenCreate', '/api/tokens', {
    payload: ApiTokenCreateRequest,
    success: ApiTokenCreated,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ApiTokenNameConflict.pipe(HttpApiSchema.status(409)),
      ApiTokenInvalidExpiration.pipe(HttpApiSchema.status(422)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.apiTokenManage]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('apiTokenRevoke', '/api/tokens/:tokenId/revoke', {
    params: { tokenId: Ulid },
    success: ApiTokenCreated.fields.token,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ApiTokenNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.apiTokenManage]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
) {}
