import { Schema } from 'effect';
import { CurrencyCode } from '../company/contracts.js';
import { Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';
import { PositiveSafeInteger } from '../documents/lines.js';
import { IntegrationFailure } from './contracts.js';

export const CheckoutRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  invoiceId: Ulid,
  expectedVersion: PositiveSafeInteger,
});
export type CheckoutRequest = typeof CheckoutRequest.Type;
export const CheckoutUrl = Schema.String.check(
  Schema.isPattern(/^https:\/\/checkout\.stripe\.com\/[^\s]+$/),
);
export const CheckoutSessionId = Schema.String.check(Schema.isPattern(/^cs_test_[A-Za-z0-9]+$/));
export const CheckoutErrorCode = Schema.Literals([
  'checkout.credentialsMissing',
  'checkout.testKeyRequired',
  'checkout.credentialsChanged',
  'checkout.permissionRevoked',
  'checkout.invoiceChanged',
  'checkout.deadline',
  'checkout.unavailable',
  'checkout.rejected',
  'checkout.rateLimited',
  'checkout.statusUnavailable',
  'checkout.statusWindowExceeded',
  'checkout.responseMismatch',
]);
export const CheckoutOperation = Schema.Struct({
  request: CheckoutRequest,
  revisionId: Ulid,
  invoiceNumber: Schema.NonEmptyString,
  amountCents: Schema.Int.check(Schema.isBetween({ minimum: 50, maximum: 99999999 })),
  currency: CurrencyCode,
  mode: Schema.Literal('test'),
  createdByUserId: Ulid,
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
  expiresAt: IsoUtc,
  status: Schema.Literals([
    'queued',
    'creating',
    'retrying',
    'open',
    'paid',
    'expired',
    'failed',
    'blocked',
  ]),
  attempts: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 5 })),
  nextAttemptAt: Schema.NullOr(IsoUtc),
  sessionId: Schema.NullOr(CheckoutSessionId),
  checkoutUrl: Schema.NullOr(CheckoutUrl),
  error: Schema.NullOr(CheckoutErrorCode),
});
export type CheckoutOperation = typeof CheckoutOperation.Type;
export const canReconcileCheckout = (operation: CheckoutOperation): boolean =>
  operation.status === 'open' && operation.nextAttemptAt === null && operation.sessionId !== null;
export const CheckoutList = Schema.Array(CheckoutOperation);
export const CheckoutConnection = Schema.Struct({
  credentialsPresent: Schema.Boolean,
  testKey: Schema.Boolean,
  webhookConfigured: Schema.Boolean,
});
export class CheckoutConflict extends Schema.TaggedError<CheckoutConflict>()(
  'CheckoutConflict',
  {
    code: Schema.Literals([
      'checkout.conflict',
      'checkout.active',
      'checkout.limit',
      'checkout.invoiceIneligible',
      'checkout.reconcileDenied',
      'checkout.notFound',
    ]),
  },
  { httpApiStatus: 409 },
) {}
export const CheckoutFailure = Schema.Union([...IntegrationFailure.members, CheckoutConflict]);
