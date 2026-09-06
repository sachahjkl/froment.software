import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import {
  Reminder,
  ReminderId,
  ReminderList,
  ReminderCreate,
  ReminderFailure,
} from './reminders.js';

const permissions = [
  Permissions.emailReminderManage,
  Permissions.invoiceRead,
  Permissions.clientRead,
  Permissions.integrationManage,
] as const;
export class RemindersApi extends HttpApiGroup.make('reminders', { topLevel: true }).add(
  HttpApiEndpoint.get('reminderList', '/api/reminders', {
    success: ReminderList,
    error: ReminderFailure.members,
  }).pipe(requirePermissions(permissions), authenticate, frontendSpecific),
  HttpApiEndpoint.put('reminderCreate', '/api/reminders/:reminderId', {
    params: { reminderId: ReminderId },
    payload: ReminderCreate,
    success: Reminder,
    error: ReminderFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions(permissions),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.post('reminderCancel', '/api/reminders/:reminderId/cancel', {
    params: { reminderId: ReminderId },
    payload: Schema.Struct({}),
    success: Reminder,
    error: ReminderFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions(permissions),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
) {}
