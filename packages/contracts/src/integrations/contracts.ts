import { Schema } from 'effect';
import { CurrencyCode } from '../company/contracts.js';
import {
  AccountEmail,
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import { Ulid } from '../identifiers.js';
import { PositiveSafeInteger } from '../documents/lines.js';

const Reference = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160));
const common = {
  requestId: Schema.String.check(Schema.isUUID(4)),
  reference: Reference,
  expectedMode: Schema.Literals(['simulation', 'live']),
};
export const EmailSubmission = Schema.Struct({
  ...common,
  kind: Schema.Literal('email'),
  recipient: AccountEmail,
  subject: Reference,
  body: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(20000)),
});
export const SignatureSubmission = Schema.Struct({
  ...common,
  kind: Schema.Literal('signature'),
  artifactId: Ulid,
  signerEmail: AccountEmail,
});
export const PaymentSubmission = Schema.Struct({
  ...common,
  kind: Schema.Literal('payment'),
  amountCents: PositiveSafeInteger,
  currency: CurrencyCode,
  customerEmail: AccountEmail,
});
export const BankingSubmission = Schema.Struct({
  ...common,
  kind: Schema.Literal('banking'),
  accountReference: Reference,
  from: CalendarDate,
  to: CalendarDate,
});
export const ElectronicInvoiceSubmission = Schema.Struct({
  ...common,
  kind: Schema.Literal('electronic-invoice'),
  artifactId: Ulid,
});
export const IntegrationSubmission = Schema.Union([
  EmailSubmission,
  SignatureSubmission,
  PaymentSubmission,
  BankingSubmission,
  ElectronicInvoiceSubmission,
]);
export type IntegrationSubmission = typeof IntegrationSubmission.Type;
export const IntegrationKind = Schema.Literals([
  'email',
  'signature',
  'payment',
  'banking',
  'electronic-invoice',
]);
export const ProviderReceipt = Schema.Union([
  Schema.Struct({
    id: Schema.NonEmptyString,
    mode: Schema.Literal('simulation'),
    status: Schema.Literal('simulated'),
  }),
  Schema.Struct({
    id: Schema.NonEmptyString,
    mode: Schema.Literal('live'),
    status: Schema.Literal('submitted'),
  }),
]);
export type ProviderReceipt = typeof ProviderReceipt.Type;
export const IntegrationOperation = Schema.Struct({
  id: Ulid,
  request: IntegrationSubmission,
  receipt: Schema.NullOr(ProviderReceipt),
  createdAt: IsoUtc,
  createdByUserId: Ulid,
});
export type IntegrationOperation = typeof IntegrationOperation.Type;
export const IntegrationOperationList = Schema.Array(IntegrationOperation);
export const IntegrationStatus = Schema.Struct({
  kind: IntegrationKind,
  mode: Schema.Literals(['simulation', 'live']),
});
export const IntegrationStatusList = Schema.Array(IntegrationStatus);
export class IntegrationConflict extends Schema.TaggedError<IntegrationConflict>()(
  'IntegrationConflict',
  { code: Schema.Literal('integration.request_conflict') },
  { httpApiStatus: 409 },
) {}
export class IntegrationInvalid extends Schema.TaggedError<IntegrationInvalid>()(
  'IntegrationInvalid',
  { code: Schema.Literal('integration.invalid_request') },
  { httpApiStatus: 422 },
) {}
export class IntegrationUnavailable extends Schema.TaggedError<IntegrationUnavailable>()(
  'IntegrationUnavailable',
  { code: Schema.Literal('integration.unavailable') },
  { httpApiStatus: 503 },
) {}
export const IntegrationFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  IntegrationConflict,
  IntegrationInvalid,
  IntegrationUnavailable,
]);
