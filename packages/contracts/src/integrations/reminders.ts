import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';
import { PositiveSafeInteger } from '../documents/lines.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const ReminderId = Schema.String.check(Schema.isUUID(4));
export const ReminderSchedule = Schema.Struct({
  invoiceId: Ulid,
  sendAt: IsoUtc,
  language: Schema.Literals(['fr', 'en']),
  expectedMode: Schema.Literals(['simulation', 'live']),
});
export const ReminderCreate = Schema.Struct({
  ...ReminderSchedule.fields,
  expectedVersion: PositiveSafeInteger,
});
export const Reminder = Schema.Struct({
  invoiceReference: Schema.NonEmptyString,
  ...ReminderCreate.fields,
  id: ReminderId,
  createdByUserId: Ulid,
  createdAt: IsoUtc,
  status: Schema.Literals(['scheduled', 'cancelled', 'skipped', 'queued']),
  reason: Schema.NullOr(
    Schema.Literals([
      'invoice-ineligible',
      'recipient-invalid',
      'permission-revoked',
      'mode-changed',
    ]),
  ),
  operationId: Schema.NullOr(Ulid),
});
export const ReminderList = Schema.Array(Reminder);
export class ReminderConflict extends Schema.TaggedError<ReminderConflict>()(
  'ReminderConflict',
  { code: Schema.Literal('reminder.conflict') },
  { httpApiStatus: 409 },
) {}
export class ReminderNotFound extends Schema.TaggedError<ReminderNotFound>()(
  'ReminderNotFound',
  { code: Schema.Literal('reminder.not_found') },
  { httpApiStatus: 404 },
) {}
export const ReminderFailure = Schema.Union([
  ReminderConflict,
  ReminderNotFound,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
]);
