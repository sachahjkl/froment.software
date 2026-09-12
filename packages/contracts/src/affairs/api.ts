import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { AuditEvent } from '../audit/contracts.js';
import { AuthenticationRequired, PermissionDenied } from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  Affair,
  AffairConflict,
  AffairCreateRequest,
  AffairList,
  AffairNotFound,
  AffairQuoteLinkRequest,
  AffairUpdateRequest,
} from './contracts.js';

export class AffairsApi extends HttpApiGroup.make('affairs', { topLevel: true }).add(
  HttpApiEndpoint.get('affairList', '/api/affairs', {
    success: AffairList,
  }).pipe(requirePermissions([Permissions.affairRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('affairGet', '/api/affairs/:affairId', {
    params: { affairId: Ulid },
    success: Affair,
    error: [AffairNotFound],
  }).pipe(requirePermissions([Permissions.affairRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('affairCreate', '/api/affairs', {
    payload: AffairCreateRequest,
    success: Affair,
    error: [AffairConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.affairCreate]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('affairUpdate', '/api/affairs/:affairId', {
    params: { affairId: Ulid },
    payload: AffairUpdateRequest,
    success: Affair,
    error: [AffairNotFound, AffairConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.affairUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('affairQuoteLink', '/api/affairs/:affairId/quotes', {
    params: { affairId: Ulid },
    payload: AffairQuoteLinkRequest,
    success: Affair,
    error: [AffairNotFound, AffairConflict],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.affairUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('affairEventList', '/api/affairs/:affairId/events', {
    params: { affairId: Ulid },
    success: Schema.Array(AuditEvent),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(
    requirePermissions([Permissions.affairRead, Permissions.auditRead]),
    authenticate,
    frontendSpecific,
  ),
) {}
