import { Schema } from 'effect';

import { DisplayName, Ulid } from './identifiers.js';
import { IsoUtc } from './temporal.js';
import { OrderReference, QuoteReference } from './business-references.js';
import { DocumentLines, documentTotalsFilter } from './document-lines.js';
import { DocumentParty, IssuerSettings } from './quotes.js';

const SafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);
export const OrderSummary = Schema.Struct({
  id: Ulid,
  reference: OrderReference,
  quoteId: Ulid,
  quoteReference: QuoteReference,
  revisionId: Ulid,
  clientId: Ulid,
  clientDisplayName: DisplayName,
  title: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  invoiceId: Schema.NullOr(Ulid),
}).annotate({ identifier: 'OrderSummary' });
export type OrderSummary = typeof OrderSummary.Type;

export const OrderList = Schema.Array(OrderSummary);
export type OrderList = typeof OrderList.Type;

export const OrderRenderSnapshot = Schema.Struct({
  templateId: Schema.Literal('order-default'),
  templateVersion: Schema.Literal(1),
  orderId: Ulid,
  revisionId: Ulid,
  orderReference: OrderReference,
  quoteReference: QuoteReference,
  confirmedAt: IsoUtc,
  issuer: IssuerSettings,
  client: DocumentParty,
  title: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  conditions: Schema.String.check(Schema.isMaxLength(2_000)),
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  lines: DocumentLines,
}).check(documentTotalsFilter);
export type OrderRenderSnapshot = typeof OrderRenderSnapshot.Type;

export const OrderDocumentArtifact = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  orderReference: OrderReference,
  kind: Schema.Literal('order-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  createdAt: IsoUtc,
});
export type OrderDocumentArtifact = typeof OrderDocumentArtifact.Type;

export class OrderNotFound extends Schema.TaggedError<OrderNotFound>()(
  'OrderNotFound',
  { code: Schema.Literal('order.not_found') },
  { httpApiStatus: 404 },
) {}
