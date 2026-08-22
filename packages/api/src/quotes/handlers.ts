import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { DocumentArtifacts } from '../documents/document-artifacts.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import { setPdfResponseHeaders, setPrivateResponseHeaders } from '../http/response.js';
import { Quotes } from './quotes.js';

export const QuoteHandlers = HttpApiBuilder.group(Api, 'quotes', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'quoteList',
        Effect.fn('quoteList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Quotes).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteGet',
        Effect.fn('quoteGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Quotes)
            .get(params.quoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quotePreview',
        Effect.fn('quotePreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setPdfResponseHeaders;
          const snapshot = yield* (yield* Quotes)
            .getSnapshot(params.quoteId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* DocumentRenderer).renderQuotePdf(snapshot).pipe(Effect.orDie);
        }),
      )
      .handle(
        'quotePdfRender',
        Effect.fn('quotePdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* DocumentArtifacts)
            .renderQuotePdf(params.quoteId, params.version, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'quotePdfDownload',
        Effect.fn('quotePdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const quote = yield* (yield* Quotes)
            .get(params.quoteId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('QuoteNotFound', Effect.orDie),
            );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${quote.reference}-v${params.version}.pdf"`,
              ),
            ),
          );
          return yield* (yield* DocumentArtifacts)
            .getQuotePdf(params.quoteId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteCreate',
        Effect.fn('quoteCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Quotes)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteRevisionCreate',
        Effect.fn('quoteRevisionCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Quotes)
            .createRevision(params.quoteId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteCancel',
        Effect.fn('quoteCancel')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Quotes)
            .cancel(params.quoteId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
