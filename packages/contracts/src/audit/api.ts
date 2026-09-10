import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Permissions } from '../permissions.js';
import {
  AuditUnavailable,
  GlobalAuditPage,
  GlobalAuditQuery,
  InvalidAuditQuery,
} from './global.js';

export class AuditApi extends HttpApiGroup.make('audit', { topLevel: true }).add(
  HttpApiEndpoint.get('auditEventList', '/api/audit-events', {
    query: GlobalAuditQuery,
    success: GlobalAuditPage,
    error: [
      InvalidAuditQuery.pipe(HttpApiSchema.status(400)),
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      AuditUnavailable.pipe(HttpApiSchema.status(503)),
    ],
  }).pipe(requirePermissions([Permissions.auditRead]), authenticate, frontendSpecific),
) {}
