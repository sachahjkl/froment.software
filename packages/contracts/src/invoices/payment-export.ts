import { Schema } from 'effect';
import { CalendarDateText } from '../temporal.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const PaymentExportQuery = Schema.Struct({ from: CalendarDateText, to: CalendarDateText });
export type PaymentExportQuery = typeof PaymentExportQuery.Type;
export class PaymentExportInvalidRange extends Schema.TaggedError<PaymentExportInvalidRange>()(
  'PaymentExportInvalidRange',
  { code: Schema.Literal('payment.export_invalid_range') },
  { httpApiStatus: 422 },
) {}
export class PaymentExportTooLarge extends Schema.TaggedError<PaymentExportTooLarge>()(
  'PaymentExportTooLarge',
  { code: Schema.Literal('payment.export_too_large') },
  { httpApiStatus: 422 },
) {}
export const PaymentExportFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  PaymentExportInvalidRange,
  PaymentExportTooLarge,
]);
