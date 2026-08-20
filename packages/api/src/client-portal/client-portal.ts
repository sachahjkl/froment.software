import {
  ClientInvoiceList,
  ClientOrderList,
  ClientQuoteList,
  DocumentNotFound,
  Ulid,
  type ClientInvoiceListValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
  type UlidValue,
} from '@froment/contracts';
import { Context, DateTime, Effect, Layer, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';

const ClientQuoteRecord = Schema.Struct({
  id: Ulid,
  status: Schema.Literals(['sent', 'accepted', 'rejected', 'expired']),
  title: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  updatedAt: Schema.Int,
  pdfAvailable: Schema.Int,
});
const ClientOrderRecord = Schema.Struct({
  id: Ulid,
  quoteId: Ulid,
  status: Schema.Literal('confirmed'),
  title: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  createdAt: Schema.Int,
  invoiceId: Schema.NullOr(Ulid),
});
const ClientInvoiceRecord = Schema.Struct({
  id: Ulid,
  orderId: Ulid,
  status: Schema.Literals(['issued', 'paid', 'void']),
  invoiceNumber: Schema.String,
  title: Schema.String,
  dueDate: Schema.String,
  currency: Schema.Literal('EUR'),
  totalCents: Schema.Int,
  updatedAt: Schema.Int,
  pdfAvailable: Schema.Int,
});
const PdfRecord = Schema.Struct({ content: Schema.Uint8Array, version: Schema.Int });

export interface ClientPdf {
  readonly content: Uint8Array;
  readonly version: number;
}

export interface ClientPortalService {
  readonly listQuotes: (userId: string) => Effect.Effect<ClientQuoteListValue, DatabaseError>;
  readonly listOrders: (userId: string) => Effect.Effect<ClientOrderListValue, DatabaseError>;
  readonly listInvoices: (userId: string) => Effect.Effect<ClientInvoiceListValue, DatabaseError>;
  readonly getQuotePdf: (
    userId: string,
    quoteId: UlidValue,
  ) => Effect.Effect<ClientPdf, DocumentNotFound | DatabaseError>;
  readonly getInvoicePdf: (
    userId: string,
    invoiceId: UlidValue,
  ) => Effect.Effect<ClientPdf, DocumentNotFound | DatabaseError>;
}

export class ClientPortal extends Context.Service<ClientPortal, ClientPortalService>()(
  '@froment/api/ClientPortal',
) {}

export const ClientPortalLive = Layer.effect(
  ClientPortal,
  Effect.gen(function* () {
    const database = yield* Database;

    const listQuotes = Effect.fn('ClientPortal.listQuotes')(function* (userId: string) {
      return yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(ClientQuoteList)(
            Schema.decodeUnknownSync(Schema.Array(ClientQuoteRecord))(
              database.sqlite
                .prepare(
                  `select quotes.id, quotes.status, quote_revisions.title,
                        quote_revisions.currency, quote_revisions.total_cents as totalCents,
                        quotes.updated_at as updatedAt,
                        document_artifacts.id is not null as pdfAvailable
                 from quotes
                 left join orders
                   on orders.quote_id = quotes.id
                  and orders.client_id = ?
                  and orders.status = 'confirmed'
                 join quote_revisions
                   on quote_revisions.id = case
                     when quotes.status = 'accepted' then orders.revision_id
                     else (select current_revision.id from quote_revisions as current_revision
                           where current_revision.quote_id = quotes.id
                             and current_revision.version = quotes.version)
                   end
                 left join document_artifacts
                   on document_artifacts.revision_id = quote_revisions.id
                  and document_artifacts.kind = 'quote-pdf'
                 where quotes.client_id = ? and quotes.status <> 'draft'
                 order by quotes.updated_at desc, quotes.id`,
                )
                .all(userId, userId),
            ).map((quote) => ({
              ...quote,
              updatedAt: DateTime.formatIso(DateTime.makeUnsafe(quote.updatedAt)),
              pdfAvailable: quote.pdfAvailable === 1,
            })),
          ),
        catch: (cause) => new DatabaseError({ operation: 'list client quotes', cause }),
      });
    });

    const listOrders = Effect.fn('ClientPortal.listOrders')(function* (userId: string) {
      return yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(ClientOrderList)(
            Schema.decodeUnknownSync(Schema.Array(ClientOrderRecord))(
              database.sqlite
                .prepare(
                  `select orders.id, orders.quote_id as quoteId, orders.status,
                        quote_revisions.title, quote_revisions.currency,
                        quote_revisions.total_cents as totalCents,
                        orders.created_at as createdAt, invoices.id as invoiceId
                 from orders
                 join quotes
                   on quotes.id = orders.quote_id
                  and quotes.client_id = ?
                  and quotes.status = 'accepted'
                 join quote_revisions
                   on quote_revisions.id = orders.revision_id
                  and quote_revisions.quote_id = orders.quote_id
                  left join invoices
                    on invoices.order_id = orders.id
                   and invoices.client_id = ?
                   and invoices.status <> 'draft'
                  where orders.client_id = ? and orders.status = 'confirmed'
                 order by orders.created_at desc, orders.id`,
                )
                .all(userId, userId, userId),
            ).map((order) => ({
              ...order,
              createdAt: DateTime.formatIso(DateTime.makeUnsafe(order.createdAt)),
            })),
          ),
        catch: (cause) => new DatabaseError({ operation: 'list client orders', cause }),
      });
    });

    const listInvoices = Effect.fn('ClientPortal.listInvoices')(function* (userId: string) {
      return yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(ClientInvoiceList)(
            Schema.decodeUnknownSync(Schema.Array(ClientInvoiceRecord))(
              database.sqlite
                .prepare(
                  `select invoices.id, invoices.order_id as orderId, invoices.status,
                        invoices.invoice_number as invoiceNumber, invoice_revisions.title,
                        invoice_revisions.due_date as dueDate, invoice_revisions.currency,
                        invoice_revisions.total_cents as totalCents,
                        invoices.updated_at as updatedAt,
                        document_artifacts.id is not null as pdfAvailable
                 from invoices
                 join orders
                   on orders.id = invoices.order_id
                  and orders.client_id = ?
                 join invoice_revisions
                   on invoice_revisions.invoice_id = invoices.id
                  and invoice_revisions.version = invoices.version
                 left join document_artifacts
                   on document_artifacts.invoice_revision_id = invoice_revisions.id
                  and document_artifacts.kind = 'invoice-pdf'
                 where invoices.client_id = ? and invoices.status <> 'draft'
                 order by invoices.updated_at desc, invoices.id`,
                )
                .all(userId, userId),
            ).map((invoice) => ({
              ...invoice,
              updatedAt: DateTime.formatIso(DateTime.makeUnsafe(invoice.updatedAt)),
              pdfAvailable: invoice.pdfAvailable === 1,
            })),
          ),
        catch: (cause) => new DatabaseError({ operation: 'list client invoices', cause }),
      });
    });

    const getQuotePdf = Effect.fn('ClientPortal.getQuotePdf')(function* (
      userId: string,
      quoteId: UlidValue,
    ) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select document_artifacts.content, quote_revisions.version
               from quotes
               left join orders
                 on orders.quote_id = quotes.id
                and orders.client_id = ?
                and orders.status = 'confirmed'
               join quote_revisions
                 on quote_revisions.id = case
                   when quotes.status = 'accepted' then orders.revision_id
                   else (select current_revision.id from quote_revisions as current_revision
                         where current_revision.quote_id = quotes.id
                           and current_revision.version = quotes.version)
                 end
               join document_artifacts
                 on document_artifacts.revision_id = quote_revisions.id
                and document_artifacts.kind = 'quote-pdf'
               where quotes.id = ? and quotes.client_id = ? and quotes.status <> 'draft'
               limit 1`,
            )
            .get(userId, quoteId, userId);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return Schema.decodeUnknownSync(PdfRecord)(row);
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get client quote PDF', cause }),
      });
    });

    const getInvoicePdf = Effect.fn('ClientPortal.getInvoicePdf')(function* (
      userId: string,
      invoiceId: UlidValue,
    ) {
      return yield* Effect.try({
        try: () => {
          const row = database.sqlite
            .prepare(
              `select document_artifacts.content, invoice_revisions.version
               from invoices
               join orders
                 on orders.id = invoices.order_id
                and orders.client_id = ?
               join invoice_revisions
                 on invoice_revisions.invoice_id = invoices.id
                and invoice_revisions.version = invoices.version
               join document_artifacts
                 on document_artifacts.invoice_revision_id = invoice_revisions.id
                and document_artifacts.kind = 'invoice-pdf'
               where invoices.id = ? and invoices.client_id = ? and invoices.status <> 'draft'
               limit 1`,
            )
            .get(userId, invoiceId, userId);
          if (row === undefined) throw new DocumentNotFound({ code: 'document.not_found' });
          return Schema.decodeUnknownSync(PdfRecord)(row);
        },
        catch: (cause) =>
          cause instanceof DocumentNotFound
            ? cause
            : new DatabaseError({ operation: 'get client invoice PDF', cause }),
      });
    });

    return ClientPortal.of({ listQuotes, listOrders, listInvoices, getQuotePdf, getInvoicePdf });
  }),
);
