import {
  OrderNotFound,
  OrderRenderSnapshot,
  QuotePreviewUnavailable,
  QuoteRenderSnapshot,
  Ulid,
  type OrderListValue,
  type OrderRenderSnapshotValue,
  type UlidValue,
} from '@froment/contracts';
import { Context, DateTime, Effect, Layer, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';

const OrderSummaryRecord = Schema.Struct({
  id: Ulid,
  reference: Schema.String,
  quoteId: Ulid,
  quoteReference: Schema.String,
  revisionId: Ulid,
  clientId: Ulid,
  clientDisplayName: Schema.NonEmptyString,
  title: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  createdAt: Schema.Int,
  invoiceId: Schema.NullOr(Ulid),
});
const OrderSnapshotRecord = Schema.Struct({
  id: Ulid,
  reference: Schema.String,
  quoteReference: Schema.String,
  revisionId: Ulid,
  createdAt: Schema.Int,
  renderSnapshot: Schema.NullOr(Schema.String),
});

export interface OrdersService {
  readonly list: Effect.Effect<OrderListValue, DatabaseError>;
  readonly getSnapshot: (
    orderId: UlidValue,
  ) => Effect.Effect<
    OrderRenderSnapshotValue,
    OrderNotFound | QuotePreviewUnavailable | DatabaseError
  >;
}

export class Orders extends Context.Service<Orders, OrdersService>()('@froment/api/Orders') {}

export const OrdersLive = Layer.effect(
  Orders,
  Effect.gen(function* () {
    const database = yield* Database;

    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(OrderSummaryRecord))(
          database.sqlite
            .prepare(
              `select orders.id, orders.reference, orders.quote_id as quoteId,
                       quotes.reference as quoteReference, orders.revision_id as revisionId,
                      clients.id as clientId,
                      quote_revisions.client_display_name as clientDisplayName,
                      quote_revisions.title, quote_revisions.currency,
                      quote_revisions.total_cents as totalCents,
                      orders.created_at as createdAt, invoices.id as invoiceId
               from orders
               join quotes on quotes.id = orders.quote_id and quotes.status = 'accepted'
               join quote_revisions
                 on quote_revisions.id = orders.revision_id
                and quote_revisions.quote_id = orders.quote_id
               join clients on clients.id = orders.client_id
               left join invoices on invoices.order_id = orders.id
               where orders.status = 'confirmed'
               order by orders.created_at desc, orders.id`,
            )
            .all(),
        ).map((order) => ({
          ...order,
          createdAt: DateTime.formatIso(DateTime.makeUnsafe(order.createdAt)),
        })),
      catch: (cause) => new DatabaseError({ operation: 'list.orders', cause }),
    });

    const getSnapshot = Effect.fn('Orders.getSnapshot')(function* (orderId: UlidValue) {
      return yield* Effect.try({
        try: () => {
          const raw = database.sqlite
            .prepare(
              `select orders.id, orders.reference, quotes.reference as quoteReference,
                      orders.revision_id as revisionId, orders.created_at as createdAt,
                      quote_revisions.render_snapshot as renderSnapshot
               from orders
               join quotes on quotes.id = orders.quote_id and quotes.status = 'accepted'
               join quote_revisions
                 on quote_revisions.id = orders.revision_id
                and quote_revisions.quote_id = orders.quote_id
               where orders.id = ? and orders.status = 'confirmed'`,
            )
            .get(orderId);
          if (raw === undefined) throw new OrderNotFound({ code: 'order.not_found' });
          const order = Schema.decodeUnknownSync(OrderSnapshotRecord)(raw);
          if (order.renderSnapshot === null) {
            throw new QuotePreviewUnavailable({ code: 'quote.preview_unavailable' });
          }
          const quote = Schema.decodeUnknownSync(QuoteRenderSnapshot)(
            JSON.parse(order.renderSnapshot),
          );
          return Schema.decodeUnknownSync(OrderRenderSnapshot)({
            templateId: 'order-default',
            templateVersion: 1,
            orderId: order.id,
            revisionId: order.revisionId,
            orderReference: order.reference,
            quoteReference: order.quoteReference,
            confirmedAt: DateTime.formatIso(DateTime.makeUnsafe(order.createdAt)),
            issuer: quote.issuer,
            client: quote.client,
            title: quote.title,
            conditions: quote.conditions,
            currency: quote.currency,
            netTotalCents: quote.netTotalCents,
            vatTotalCents: quote.vatTotalCents,
            totalCents: quote.totalCents,
            lines: quote.lines,
          });
        },
        catch: (cause) =>
          cause instanceof OrderNotFound || cause instanceof QuotePreviewUnavailable
            ? cause
            : new DatabaseError({ operation: 'get.order.snapshot', cause }),
      });
    });

    return Orders.of({ list, getSnapshot });
  }),
);
