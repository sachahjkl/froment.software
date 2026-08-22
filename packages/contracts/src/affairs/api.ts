import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { AuditEvent } from '../audit/contracts.js';
import { AuthenticationRequired, PermissionDenied } from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';

export class AffairsApi extends HttpApiGroup.make('affairs', { topLevel: true }).add(
  HttpApiEndpoint.get('affairEventList', '/api/affairs/:quoteId/events', {
    params: { quoteId: Ulid },
    success: Schema.Array(AuditEvent),
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(
    requirePermissions([Permissions.quoteRead, Permissions.auditRead]),
    authenticate,
    frontendSpecific,
  ),
) {}
