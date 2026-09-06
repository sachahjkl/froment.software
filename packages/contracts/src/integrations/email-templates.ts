import { Schema } from 'effect';
import { SafeInteger, PositiveSafeInteger } from '../documents/lines.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { IsoUtc } from '../temporal.js';

export const EmailTemplateId = Schema.String.check(Schema.isUUID(4));
export const EmailTemplateContent = Schema.Struct({
  subject: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  body: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(20000)),
});
export const EmailTemplateSave = Schema.Struct({
  ...EmailTemplateContent.fields,
  expectedVersion: SafeInteger,
});
export const EmailTemplate = Schema.Struct({
  ...EmailTemplateContent.fields,
  id: EmailTemplateId,
  version: PositiveSafeInteger,
  updatedAt: IsoUtc,
});
export const EmailTemplateList = Schema.Array(EmailTemplate);
export const EmailTemplateArchive = Schema.Struct({ expectedVersion: PositiveSafeInteger });
export class EmailTemplateConflict extends Schema.TaggedError<EmailTemplateConflict>()(
  'EmailTemplateConflict',
  {
    code: Schema.Literal('email_template.conflict'),
  },
  { httpApiStatus: 409 },
) {}
export class EmailTemplateNotFound extends Schema.TaggedError<EmailTemplateNotFound>()(
  'EmailTemplateNotFound',
  {
    code: Schema.Literal('email_template.not_found'),
  },
  { httpApiStatus: 404 },
) {}
export const EmailTemplateFailure = Schema.Union([
  EmailTemplateConflict,
  EmailTemplateNotFound,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
]);
