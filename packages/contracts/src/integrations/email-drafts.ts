import { Schema } from 'effect';
import { SafeInteger, PositiveSafeInteger } from '../documents/lines.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { IsoUtc } from '../temporal.js';

export const EmailDraftId = Schema.String.check(Schema.isUUID(4));
export const EmailDraftContent = Schema.Struct({
  recipient: Schema.String.check(Schema.isMaxLength(254)),
  reference: Schema.String.check(Schema.isMaxLength(160)),
  subject: Schema.String.check(Schema.isMaxLength(160)),
  body: Schema.String.check(Schema.isMaxLength(20000)),
  reminder: Schema.Boolean,
});
export const EmailDraftSave = Schema.Struct({
  ...EmailDraftContent.fields,
  expectedVersion: SafeInteger,
});
export const EmailDraft = Schema.Struct({
  ...EmailDraftContent.fields,
  id: EmailDraftId,
  version: PositiveSafeInteger,
  updatedAt: IsoUtc,
});
export const EmailDraftList = Schema.Array(EmailDraft);
export const EmailDraftArchive = Schema.Struct({ expectedVersion: PositiveSafeInteger });
export class EmailDraftConflict extends Schema.TaggedError<EmailDraftConflict>()(
  'EmailDraftConflict',
  {
    code: Schema.Literal('email_draft.conflict'),
  },
  { httpApiStatus: 409 },
) {}
export class EmailDraftNotFound extends Schema.TaggedError<EmailDraftNotFound>()(
  'EmailDraftNotFound',
  {
    code: Schema.Literal('email_draft.not_found'),
  },
  { httpApiStatus: 404 },
) {}
export const EmailDraftFailure = Schema.Union([
  EmailDraftConflict,
  EmailDraftNotFound,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
]);
