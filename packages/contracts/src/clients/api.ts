import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import {
  ClientAccess,
  ClientArchived,
  ClientCreateRequest,
  ClientList,
  ClientNotFound,
  ClientSummary,
  ClientUpdateRequest,
  ClientVersionConflict,
} from '../clients/contracts.js';
import { Ulid } from '../identifiers.js';
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
  }).pipe(requirePermissions([Permissions.clientRead])),
  HttpApiEndpoint.get('clientGet', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientRead])),
  HttpApiEndpoint.post('clientCreate', '/api/clients', {
    payload: ClientCreateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.clientCreate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.put('clientUpdate', '/api/clients/:clientId', {
    params: { clientId: Ulid },
    payload: ClientUpdateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
      ClientVersionConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.clientUpdate]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientArchive', '/api/clients/:clientId/archive', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientArchive]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientReactivate', '/api/clients/:clientId/reactivate', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(requirePermissions([Permissions.clientArchive]), rateLimit(RateLimits.sixtyPerMinute)),
  HttpApiEndpoint.post('clientAccessCreate', '/api/clients/:clientId/access', {
    params: { clientId: Ulid },
    success: ClientAccess,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
    ],
  }).pipe(
    requirePermissions([Permissions.clientAccessCreate]),
    rateLimit(RateLimits.tenPerMinute),
    frontendSpecific,
  ),
) {}
