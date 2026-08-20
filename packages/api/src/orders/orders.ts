import { Ulid, type OrderListValue } from '@froment/contracts';
import { Context, DateTime, Effect, Layer, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';

const OrderSummaryRecord = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  revisionId: Ulid,
  clientId: Ulid,
  clientDisplayName: Schema.NonEmptyString,
  title: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  createdAt: Schema.Int,
  invoiceId: Schema.NullOr(Ulid),
});

export interface OrdersService {
  readonly list: Effect.Effect<OrderListValue, DatabaseError>;
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
              `select orders.id, orders.quote_id as quoteId, orders.revision_id as revisionId,
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
      catch: (cause) => new DatabaseError({ operation: 'list orders', cause }),
    });

    return Orders.of({ list });
  }),
);
