import { Schema } from 'effect';
import { AccountEmail } from '../authentication/contracts.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import { PositiveSafeInteger, SafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';
import {
  IntegrationKind,
  IntegrationInvalid,
  IntegrationUnavailable,
  IntegrationFailure,
} from './contracts.js';

export class ProviderNotFound extends Schema.TaggedError<ProviderNotFound>()(
  'ProviderNotFound',
  {
    code: Schema.Literal('provider.not_found'),
  },
  { httpApiStatus: 404 },
) {}
export class ProviderRejected extends Schema.TaggedError<ProviderRejected>()(
  'ProviderRejected',
  {
    code: Schema.Literal('provider.rejected'),
    reason: Schema.Literals([
      'invalid-state',
      'insufficient-funds',
      'unsupported-operation',
      'permission-denied',
      'expired-consent',
    ]),
  },
  { httpApiStatus: 409 },
) {}
export class ProviderRateLimited extends Schema.TaggedError<ProviderRateLimited>()(
  'ProviderRateLimited',
  {
    code: Schema.Literal('provider.rate_limited'),
    retryAfterSeconds: PositiveSafeInteger,
  },
  { httpApiStatus: 429 },
) {}
export const ProviderActionError = Schema.Union([
  IntegrationInvalid,
  IntegrationUnavailable,
  ProviderNotFound,
  ProviderRejected,
  ProviderRateLimited,
]);
export const ProviderActionFailure = Schema.Union([
  ...IntegrationFailure.members,
  ProviderNotFound,
  ProviderRejected,
  ProviderRateLimited,
]);

const Text = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(1000));
const Reference = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(200));
const RequestId = Schema.String.check(Schema.isUUID(4));
const command = { requestId: RequestId };
export const ProviderResourceRequest = Schema.Struct({ ...command, providerId: Reference });
export const ProviderCancelRequest = Schema.Struct({
  ...ProviderResourceRequest.fields,
  reason: Text,
});
export const ProviderPageRequest = Schema.Struct({
  ...command,
  cursor: Schema.NullOr(Reference),
  limit: SafeInteger.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
});
export const ProviderEventRequest = Schema.Struct({
  ...ProviderPageRequest.fields,
  providerId: Reference,
});
export const ProviderWebhookRequest = Schema.Struct({
  ...command,
  bodyBase64: Schema.String.check(Schema.isMaxLength(100000)),
  signature: Schema.String.check(Schema.isMaxLength(4000)),
  receivedAt: IsoUtc,
});
export const ProviderEvent = Schema.Struct({
  id: Reference,
  providerId: Reference,
  occurredAt: IsoUtc,
  kind: IntegrationKind,
  status: Schema.Literals([
    'draft',
    'queued',
    'submitted',
    'delivered',
    'bounced',
    'complained',
    'cancelled',
    'failed',
    'pending',
    'signed',
    'declined',
    'expired',
    'requires-action',
    'authorized',
    'captured',
    'succeeded',
    'pending-consent',
    'active',
    'revoked',
    'accepted',
    'rejected',
    'received',
    'approved',
    'disputed',
    'paid',
    'booked',
    'reversed',
  ]),
});
const page = <S extends Schema.Constraint>(item: S) =>
  Schema.Struct({ items: Schema.Array(item), nextCursor: Schema.NullOr(Reference) });
const result = <S extends Schema.Constraint>(value: S) =>
  Schema.Union([
    Schema.Struct({
      mode: Schema.Literal('simulation'),
      executed: Schema.Literal(false),
      requestId: RequestId,
      preview: value,
    }),
    Schema.Struct({
      mode: Schema.Literal('live'),
      executed: Schema.Literal(true),
      requestId: RequestId,
      result: value,
    }),
  ]);
const action = <I extends Schema.Constraint, O extends Schema.Constraint>(
  request: I,
  response: O,
) => ({ request, response: result(response) });
export const EmailDelivery = Schema.Struct({
  providerId: Reference,
  status: Schema.Literals([
    'queued',
    'submitted',
    'delivered',
    'bounced',
    'complained',
    'cancelled',
    'failed',
  ]),
  recipient: AccountEmail,
  updatedAt: IsoUtc,
  failureCode: Schema.NullOr(Reference),
});
export const SignatureStatus = Schema.Struct({
  providerId: Reference,
  artifactId: Ulid,
  status: Schema.Literals([
    'draft',
    'pending',
    'signed',
    'declined',
    'expired',
    'cancelled',
    'failed',
  ]),
  signers: Schema.Array(
    Schema.Struct({
      email: AccountEmail,
      status: Schema.Literals(['pending', 'signed', 'declined']),
      signedAt: Schema.NullOr(IsoUtc),
    }),
  ),
  updatedAt: IsoUtc,
});
export const ProviderFile = Schema.Union([
  Schema.Struct({ available: Schema.Literal(false) }),
  Schema.Struct({
    available: Schema.Literal(true),
    filename: Reference,
    mediaType: Schema.Literals([
      'application/pdf',
      'application/json',
      'application/xml',
      'application/zip',
    ]),
    contentBase64: Schema.String,
    sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  }),
]);
export const ProviderPayment = Schema.Struct({
  providerId: Reference,
  status: Schema.Literals([
    'pending',
    'requires-action',
    'authorized',
    'captured',
    'cancelled',
    'failed',
  ]),
  amountCents: PositiveSafeInteger,
  capturedCents: SafeInteger,
  refundedCents: SafeInteger,
  currency: Schema.Literal('EUR'),
  checkoutUrl: Schema.NullOr(Schema.String),
  updatedAt: IsoUtc,
});
export const ProviderRefund = Schema.Struct({
  providerId: Reference,
  paymentId: Reference,
  amountCents: PositiveSafeInteger,
  currency: Schema.Literal('EUR'),
  status: Schema.Literals(['pending', 'succeeded', 'failed', 'cancelled']),
  updatedAt: IsoUtc,
});
export const ProviderRefundRequest = Schema.Struct({
  ...ProviderResourceRequest.fields,
  amountCents: PositiveSafeInteger,
  reason: Text,
});
export const BankConnection = Schema.Struct({
  providerId: Reference,
  status: Schema.Literals(['pending-consent', 'active', 'expired', 'revoked', 'failed']),
  consentUrl: Schema.NullOr(Schema.String),
  expiresAt: Schema.NullOr(IsoUtc),
});
export const ProviderBankAccount = Schema.Struct({
  providerId: Reference,
  name: Reference,
  iban: Schema.NullOr(Reference),
  currency: Schema.Literal('EUR'),
});
export const ProviderBankTransaction = Schema.Struct({
  providerId: Reference,
  accountId: Reference,
  bookedOn: CalendarDate,
  amountCents: Schema.Int.check(
    Schema.isBetween({ minimum: -Number.MAX_SAFE_INTEGER, maximum: Number.MAX_SAFE_INTEGER }),
  ),
  currency: Schema.Literal('EUR'),
  description: Text,
  status: Schema.Literals(['pending', 'booked', 'reversed']),
});
export const ProviderBankQuery = Schema.Struct({
  ...ProviderEventRequest.fields,
  from: CalendarDate,
  to: CalendarDate,
}).check(
  Schema.makeFilter((request) => request.from <= request.to, {
    message: 'provider.invalid_date_range',
  }),
);
export const ElectronicInvoiceStatus = Schema.Struct({
  providerId: Reference,
  artifactId: Ulid,
  status: Schema.Literals([
    'submitted',
    'accepted',
    'rejected',
    'delivered',
    'received',
    'approved',
    'disputed',
    'paid',
    'cancelled',
    'failed',
  ]),
  direction: Schema.Literals(['incoming', 'outgoing']),
  updatedAt: IsoUtc,
  rejectionCode: Schema.NullOr(Reference),
});
export const ElectronicReport = Schema.Struct({
  providerId: Reference,
  from: CalendarDate,
  to: CalendarDate,
  status: Schema.Literals(['submitted', 'accepted', 'rejected', 'failed']),
  rejectionCode: Schema.NullOr(Reference),
});
export const ElectronicReportRequest = Schema.Struct({
  ...command,
  from: CalendarDate,
  to: CalendarDate,
  entries: Schema.Array(
    Schema.Struct({
      invoiceId: Ulid,
      amountCents: PositiveSafeInteger,
      currency: Schema.Literal('EUR'),
      paidOn: Schema.NullOr(CalendarDate),
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(1000)),
}).check(
  Schema.makeFilter((request) => request.from <= request.to, {
    message: 'provider.invalid_date_range',
  }),
);
const events = action(ProviderEventRequest, page(ProviderEvent));
const webhook = action(
  ProviderWebhookRequest,
  Schema.Struct({ verified: Schema.Boolean, events: Schema.Array(ProviderEvent) }),
);

export const EmailActions = {
  get: action(ProviderResourceRequest, EmailDelivery),
  cancel: action(ProviderCancelRequest, EmailDelivery),
  events,
  verifyWebhook: webhook,
};
export const SignatureActions = {
  get: action(ProviderResourceRequest, SignatureStatus),
  cancel: action(ProviderCancelRequest, SignatureStatus),
  remind: action(ProviderResourceRequest, SignatureStatus),
  signedDocument: action(ProviderResourceRequest, ProviderFile),
  proof: action(ProviderResourceRequest, ProviderFile),
  events,
  verifyWebhook: webhook,
};
export const PaymentActions = {
  get: action(ProviderResourceRequest, ProviderPayment),
  cancel: action(ProviderCancelRequest, ProviderPayment),
  capture: action(
    Schema.Struct({ ...ProviderResourceRequest.fields, amountCents: PositiveSafeInteger }),
    ProviderPayment,
  ),
  refund: action(ProviderRefundRequest, ProviderRefund),
  getRefund: action(ProviderResourceRequest, ProviderRefund),
  events,
  verifyWebhook: webhook,
};
export const BankingActions = {
  connect: action(
    Schema.Struct({ ...command, returnUrl: Schema.String, accountReference: Reference }),
    BankConnection,
  ),
  getConnection: action(ProviderResourceRequest, BankConnection),
  revokeConnection: action(ProviderCancelRequest, BankConnection),
  accounts: action(ProviderEventRequest, page(ProviderBankAccount)),
  transactions: action(ProviderBankQuery, page(ProviderBankTransaction)),
  verifyWebhook: webhook,
};
export const ElectronicInvoiceActions = {
  get: action(ProviderResourceRequest, ElectronicInvoiceStatus),
  cancel: action(ProviderCancelRequest, ElectronicInvoiceStatus),
  download: action(ProviderResourceRequest, ProviderFile),
  inbox: action(ProviderPageRequest, page(ElectronicInvoiceStatus)),
  report: action(ElectronicReportRequest, ElectronicReport),
  getReport: action(ProviderResourceRequest, ElectronicReport),
  events,
  verifyWebhook: webhook,
};
