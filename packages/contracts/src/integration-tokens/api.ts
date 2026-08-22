import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import {
  IntegrationTokenCreateRequest,
  IntegrationTokenCreated,
  IntegrationTokenInvalidCursor,
  IntegrationTokenInvalidExpiration,
  IntegrationTokenListQuery,
  IntegrationTokenNameConflict,
  IntegrationTokenNotFound,
  IntegrationTokenPage,
} from '../integration-tokens/contracts.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';

export class IntegrationTokensApi extends HttpApiGroup.make('integrationTokens', {
  topLevel: true,
})
  .add(
    HttpApiEndpoint.get('integrationTokenList', '/api/integration-tokens', {
      query: IntegrationTokenListQuery,
      success: IntegrationTokenPage,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        IntegrationTokenInvalidCursor.pipe(HttpApiSchema.status(400)),
      ],
    }).pipe(requirePermissions([Permissions.integrationTokenManage]), frontendSpecific),
    HttpApiEndpoint.post('integrationTokenCreate', '/api/integration-tokens', {
      payload: IntegrationTokenCreateRequest,
      success: IntegrationTokenCreated,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
        IntegrationTokenNameConflict.pipe(HttpApiSchema.status(409)),
        IntegrationTokenInvalidExpiration.pipe(HttpApiSchema.status(422)),
      ],
    })
      .middleware(ApiRequestBody)
      .pipe(
        requirePermissions([Permissions.integrationTokenManage]),
        rateLimit(RateLimits.tenPerMinute),
        frontendSpecific,
      ),
    HttpApiEndpoint.post('integrationTokenRevoke', '/api/integration-tokens/:tokenId/revoke', {
      params: { tokenId: Ulid },
      success: IntegrationTokenCreated.fields.token,
      error: [
        AuthenticationRequired.pipe(HttpApiSchema.status(401)),
        PermissionDenied.pipe(HttpApiSchema.status(403)),
        CsrfRejected.pipe(HttpApiSchema.status(403)),
        RequestRateLimited.pipe(HttpApiSchema.status(429)),
        IntegrationTokenNotFound.pipe(HttpApiSchema.status(404)),
      ],
    }).pipe(
      requirePermissions([Permissions.integrationTokenManage]),
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  )
  .annotate(OpenApi.Exclude, true) {}
