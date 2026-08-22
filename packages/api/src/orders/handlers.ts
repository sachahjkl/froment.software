import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { DocumentArtifacts } from '../documents/document-artifacts.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import { setPdfResponseHeaders, setPrivateResponseHeaders } from '../http/response.js';
import { Orders } from './orders.js';

export const OrderHandlers = HttpApiBuilder.group(Api, 'orders', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'orderList',
        Effect.fn('orderList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Orders).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'orderPreview',
        Effect.fn('orderPreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const snapshot = yield* (yield* Orders)
            .getSnapshot(params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* DocumentRenderer).renderOrderPdf(snapshot).pipe(Effect.orDie);
        }),
      )
      .handle(
        'orderPdfRender',
        Effect.fn('orderPdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* DocumentArtifacts)
            .renderOrderPdf(params.orderId, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'orderPdfDownload',
        Effect.fn('orderPdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const pdf = yield* (yield* DocumentArtifacts)
            .getOrderPdf(params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
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
