import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { IssuerSettings, IssuerSettingsUpdateRequest } from '../documents/contracts.js';
import { Permissions } from '../permissions.js';

export class IssuerSettingsApi extends HttpApiGroup.make('issuerSettings', { topLevel: true }).add(
  HttpApiEndpoint.get('issuerSettingsGet', '/api/issuer-settings', {
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.templateRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('issuerSettingsUpdate', '/api/issuer-settings', {
    payload: IssuerSettingsUpdateRequest,
    success: IssuerSettings,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.templateSelect]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
