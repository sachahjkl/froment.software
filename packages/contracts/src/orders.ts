import { Schema } from 'effect';

import { DisplayName, Ulid } from './identifiers.js';
import { IsoUtc } from './temporal.js';

const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
export const OrderSummary = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  revisionId: Ulid,
  clientId: Ulid,
  clientDisplayName: DisplayName,
  title: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  invoiceId: Schema.NullOr(Ulid),
});
export type OrderSummary = typeof OrderSummary.Type;

export const OrderList = Schema.Array(OrderSummary);
export type OrderList = typeof OrderList.Type;
