import { Schema } from 'effect';

import { Ulid } from './identifiers.js';

const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
const IsoUtc = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
);

export const OrderSummary = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  revisionId: Ulid,
  clientId: Ulid,
  clientDisplayName: Schema.NonEmptyString,
  title: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  invoiceId: Schema.NullOr(Ulid),
});
export type OrderSummary = typeof OrderSummary.Type;

export const OrderList = Schema.Array(OrderSummary);
export type OrderList = typeof OrderList.Type;
