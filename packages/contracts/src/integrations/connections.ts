import { Schema } from 'effect';
import { IsoUtc } from '../temporal.js';
import { Ulid } from '../identifiers.js';
import { IntegrationFailure } from './contracts.js';

export const ProviderConnection = Schema.Struct({
  provider: Schema.Literals(['resend', 'stripe', 'signwell', 'superpdp']),
  credentialsPresent: Schema.Boolean,
  missingSecrets: Schema.Array(Schema.String),
  mode: Schema.Literals(['restricted-test', 'not-connected']),
});
export const ProviderConnections = Schema.Array(ProviderConnection);

export const EmailTestAddress = {
  from: 'Sacha — froment.software <sacha@mail.froment.software>',
  replyTo: 'sacha@froment.software',
  recipient: 'sacha@sacha.house',
} as const;

export const EmailTestRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  subject: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isPattern(/^[^\r\n]*$/),
    Schema.isMaxLength(160),
  ),
  body: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(20000)),
});
export type EmailTestRequest = typeof EmailTestRequest.Type;

export const EmailTestErrorCode = Schema.Literals([
  'emailTest.credentialsMissing',
  'emailTest.credentialsChanged',
  'emailTest.permissionRevoked',
  'emailTest.rejected',
  'emailTest.rateLimited',
  'emailTest.unavailable',
  'emailTest.expired',
  'emailTest.statusUnavailable',
]);
export const EmailTestOperation = Schema.Struct({
  request: EmailTestRequest,
  createdByUserId: Ulid,
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
  status: Schema.Literals([
    'queued',
    'sending',
    'retrying',
    'accepted',
    'delivered',
    'bounced',
    'complained',
    'failed',
    'blocked',
  ]),
  attempts: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 5 })),
  nextAttemptAt: Schema.NullOr(IsoUtc),
  providerId: Schema.NullOr(Schema.String.check(Schema.isUUID())),
  error: Schema.NullOr(EmailTestErrorCode),
});
export type EmailTestOperation = typeof EmailTestOperation.Type;
export const EmailTestList = Schema.Array(EmailTestOperation);
export class EmailTestConflict extends Schema.TaggedError<EmailTestConflict>()(
  'EmailTestConflict',
  { code: Schema.Literals(['emailTest.conflict', 'emailTest.active', 'emailTest.limit']) },
  { httpApiStatus: 409 },
) {}
export const EmailTestFailure = Schema.Union([...IntegrationFailure.members, EmailTestConflict]);
