import { Api, DocumentNotFound } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { authorizeClient } from '../authentication/http.js';
import { Clients } from '../clients/clients.js';
import { DocumentArtifacts } from '../documents/document-artifacts.js';
import { setPdfResponseHeaders, setPrivateResponseHeaders } from '../http/response.js';
import { ClientPortal } from './client-portal.js';

export const ClientPortalHandlers = HttpApiBuilder.group(Api, 'clientPortal', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'clientQuoteList',
        Effect.fn('clientQuoteList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('quote.read');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* ClientPortal)
            .listQuotes(clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientOrderList',
        Effect.fn('clientOrderList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('order.read');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* ClientPortal)
            .listOrders(clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientInvoiceList',
        Effect.fn('clientInvoiceList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('invoice.read');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* ClientPortal)
            .listInvoices(clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientQuotePdf',
        Effect.fn('clientQuotePdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const pdf = yield* (yield* ClientPortal)
            .getQuotePdf(clientId, params.quoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'clientInvoicePdf',
        Effect.fn('clientInvoicePdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const pdf = yield* (yield* ClientPortal)
            .getInvoicePdf(clientId, params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'clientOrderPdf',
        Effect.fn('clientOrderPdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const clientId = yield* (yield* Clients)
            .resolveAccessClientId(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const portal = yield* ClientPortal;
          yield* portal
            .authorizeOrder(clientId, params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const pdf = yield* portal.getOrderPdf(clientId, params.orderId).pipe(
            Effect.catchTag('DocumentNotFound', () =>
              Effect.gen(function* () {
                yield* (yield* DocumentArtifacts).renderOrderPdf(params.orderId, null).pipe(
                  Effect.catchTag('DatabaseError', Effect.orDie),
                  Effect.catchTag('DocumentRenderError', Effect.orDie),
                  Effect.catchTag('OrderNotFound', Effect.orDie),
                  Effect.catchTag('QuotePreviewUnavailable', () =>
                    Effect.fail(new DocumentNotFound({ code: 'document.not_found' })),
                  ),
                );
                return yield* portal
                  .getOrderPdf(clientId, params.orderId)
                  .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
              }),
            ),
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      ),
  ),
);
