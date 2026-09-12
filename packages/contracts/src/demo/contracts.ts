import { Schema } from 'effect';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const DemoClientCount = 50;
export const DemoSupplierCount = 30;
export const DemoAffairCount = 100;
export const DemoQuoteCount = 180;
export const DemoSupplierInvoiceCount = 120;
export const DemoBankTransactionCount = 240;
export const DemoAccountingEntryCount = 48;

export const DemoResetResult = Schema.Struct({
  clients: Schema.Int,
  suppliers: Schema.Int,
  affairs: Schema.Int,
  quotes: Schema.Int,
  supplierInvoices: Schema.Int,
  bankTransactions: Schema.Int,
  accountingEntries: Schema.Int,
});
export const DemoResetRequest = Schema.Struct({
  password: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1_024)),
  confirmed: Schema.Literal(true),
});
export type DemoResetRequest = typeof DemoResetRequest.Type;
export type DemoResetResult = typeof DemoResetResult.Type;
export class DemoResetRejected extends Schema.TaggedError<DemoResetRejected>()(
  'DemoResetRejected',
  {
    code: Schema.Literals([
      'demo.environment_rejected',
      'demo.secret_missing',
      'demo.password_invalid',
    ]),
  },
) {}
export const DemoFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  DemoResetRejected,
]);
