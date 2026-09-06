import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import {
  EmailTemplate,
  EmailTemplateId,
  EmailTemplateList,
  EmailTemplateSave,
  EmailTemplateArchive,
  EmailTemplateFailure,
} from './email-templates.js';

export class EmailTemplatesApi extends HttpApiGroup.make('emailTemplates', { topLevel: true }).add(
  HttpApiEndpoint.get('emailTemplateList', '/api/email-templates', {
    success: EmailTemplateList,
    error: EmailTemplateFailure.members,
  }).pipe(requirePermissions([Permissions.emailTemplateManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('emailTemplateSave', '/api/email-templates/:templateId', {
    params: { templateId: EmailTemplateId },
    payload: EmailTemplateSave,
    success: EmailTemplate,
    error: EmailTemplateFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.emailTemplateManage]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('emailTemplateArchive', '/api/email-templates/:templateId/archive', {
    params: { templateId: EmailTemplateId },
    payload: EmailTemplateArchive,
    success: HttpApiSchema.NoContent,
    error: EmailTemplateFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.emailTemplateManage]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
