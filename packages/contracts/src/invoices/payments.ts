import { Schema } from 'effect';
import { PositiveSafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';
import { CalendarDate, IsoUtc } from '../temporal.js';

export const InvoicePaymentRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  expectedVersion: PositiveSafeInteger,
  amountCents: PositiveSafeInteger,
  paidOn: CalendarDate,
  method: Schema.Literals(['transfer', 'card', 'cash', 'cheque', 'other']),
  reference: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
});
export type InvoicePaymentRequest = typeof InvoicePaymentRequest.Type;
export const InvoicePayment = Schema.Struct({
  ...InvoicePaymentRequest.fields,
  id: Ulid,
  recordedAt: IsoUtc,
  recordedByUserId: Ulid,
});
export type InvoicePayment = typeof InvoicePayment.Type;
export class InvoicePaymentInvalid extends Schema.TaggedError<InvoicePaymentInvalid>()(
  'InvoicePaymentInvalid',
  { code: Schema.Literal('invoice.payment_invalid') },
  { httpApiStatus: 409 },
) {}
