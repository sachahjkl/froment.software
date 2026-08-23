import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import {
  ClientAccess,
  ClientAccessList,
  ClientAccessNotFound,
  ClientAccessRequest,
  ClientArchived,
  ClientEmailConflict,
  ClientCreateRequest,
  ClientList,
  ClientNotFound,
  ClientSummary,
  ClientUpdateRequest,
  ClientVersionConflict,
} from '../clients/contracts.js';
import { Ulid } from '../identifiers.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';

export class ClientsApi extends HttpApiGroup.make('clients', { topLevel: true }).add(
  HttpApiEndpoint.get('clientList', '/api/clients', {
    success: ClientList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.clientRead]), authenticate),
  HttpApiEndpoint.get('clientGet', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientRead]), authenticate),
  HttpApiEndpoint.post('clientCreate', '/api/clients', {
    payload: ClientCreateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.clientCreate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.put('clientUpdate', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    payload: ClientUpdateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      ClientVersionConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.clientUpdate]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
    ),
  HttpApiEndpoint.post('clientArchive', '/api/clients/:clientId/archive', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.clientArchive]),
    authenticate,
    rateLimit(RateLimits.sixtyPerMinute),
  ),
  HttpApiEndpoint.post('clientReactivate', '/api/clients/:clientId/reactivate', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.clientArchive]),
    authenticate,
    rateLimit(RateLimits.sixtyPerMinute),
  ),
  HttpApiEndpoint.get('clientAccessList', '/api/clients/:clientId/access', {
    params: { clientId: Ulid },
    success: ClientAccessList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientAccessManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('clientAccessCreate', '/api/clients/:clientId/access', {
    params: { clientId: Ulid },
    payload: ClientAccessRequest,
    success: ClientAccess,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      ClientEmailConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.clientAccessManage]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.delete('clientAccessRevoke', '/api/clients/:clientId/access/:accessId', {
    params: { clientId: Ulid, accessId: Ulid },
    success: HttpApiSchema.NoContent,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientAccessNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.clientAccessManage]),
    authenticate,
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
) {}
