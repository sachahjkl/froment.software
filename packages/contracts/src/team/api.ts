import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import { RequestRateLimited } from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import {
  TeamAccept,
  TeamFailure,
  TeamInvitationId,
  TeamInvite,
  TeamInviteResult,
  TeamList,
  TeamMemberUpdate,
} from './contracts.js';

export class TeamApi extends HttpApiGroup.make('team', { topLevel: true }).add(
  HttpApiEndpoint.get('teamList', '/api/team', {
    success: TeamList,
    error: TeamFailure.members,
  }).pipe(requirePermissions([Permissions.userRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('teamInvite', '/api/team/invitations', {
    payload: TeamInvite,
    success: TeamInviteResult,
    error: TeamFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.userCreate]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('teamInvitationCancel', '/api/team/invitations/:invitationId/cancel', {
    params: { invitationId: TeamInvitationId },
    success: HttpApiSchema.NoContent,
    error: TeamFailure.members,
  })
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.userCreate]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('teamMemberUpdate', '/api/team/members/:userId', {
    params: { userId: Ulid },
    payload: TeamMemberUpdate,
    success: HttpApiSchema.NoContent,
    error: TeamFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(requirePermissions([Permissions.userUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('teamInvitationAccept', '/api/team/accept', {
    payload: TeamAccept,
    success: HttpApiSchema.NoContent,
    error: [...TeamFailure.members, RequestRateLimited],
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
) {}
