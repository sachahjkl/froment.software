import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import {
  EmailDraft,
  EmailDraftId,
  EmailDraftList,
  EmailDraftSave,
  EmailDraftArchive,
  EmailDraftFailure,
} from './email-drafts.js';

export class EmailDraftsApi extends HttpApiGroup.make('emailDrafts', { topLevel: true }).add(
  HttpApiEndpoint.get('emailDraftList', '/api/email-drafts', {
    success: EmailDraftList,
    error: EmailDraftFailure.members,
  }).pipe(requirePermissions([Permissions.emailDraftManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('emailDraftSave', '/api/email-drafts/:draftId', {
    params: { draftId: EmailDraftId },
    payload: EmailDraftSave,
    success: EmailDraft,
    error: EmailDraftFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.emailDraftManage]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('emailDraftArchive', '/api/email-drafts/:draftId/archive', {
    params: { draftId: EmailDraftId },
    payload: EmailDraftArchive,
    success: HttpApiSchema.NoContent,
    error: EmailDraftFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.emailDraftManage]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
