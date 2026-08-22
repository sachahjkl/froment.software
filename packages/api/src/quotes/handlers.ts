import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpEffect, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Audit } from '../audit/audit.js';
import { DocumentArtifacts } from '../documents/document-artifacts.js';
import { DocumentRenderer } from '../documents/document-renderer.js';
import { getClientAddress } from '../http/request.js';
import {
  setDocumentResponseHeaders,
  setPrivateResponseHeaders,
  setPublicDocumentResponseHeaders,
} from '../http/response.js';
import { IssuerSettings } from '../issuer-settings/service.js';
import { limitPublicQuoteRequest, PublicQuoteRateLimits } from '../quote-links/request-limit.js';
import { QuoteLinks } from '../quote-links/service.js';
import { QuoteConditionPresets } from '../quote-condition-presets/service.js';
import { Quotes } from './quotes.js';

export const QuoteHandlers = HttpApiBuilder.group(Api, 'quotes', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'quoteConditionPresetList',
        Effect.fn('quoteConditionPresetList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* QuoteConditionPresets).list.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'quoteConditionPresetCreate',
        Effect.fn('quoteConditionPresetCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* QuoteConditionPresets)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteConditionPresetUpdate',
        Effect.fn('quoteConditionPresetUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* QuoteConditionPresets)
            .update(params.presetId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteConditionPresetDelete',
        Effect.fn('quoteConditionPresetDelete')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* QuoteConditionPresets)
            .remove(params.presetId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'issuerSettingsGet',
        Effect.fn('issuerSettingsGet')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* IssuerSettings).get.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'issuerSettingsUpdate',
        Effect.fn('issuerSettingsUpdate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* IssuerSettings)
            .update(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
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
        'affairEventList',
        Effect.fn('affairEventList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Audit)
            .listAffair(params.quoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quotePreview',
        Effect.fn('quotePreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          const snapshot = yield* (yield* Quotes)
            .getSnapshot(params.quoteId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* DocumentRenderer).renderQuote(snapshot).pipe(Effect.orDie);
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
        'quoteSend',
        Effect.fn('quoteSend')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* QuoteLinks)
            .send(params.quoteId, payload, principal.userId)
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
      )
      .handle(
        'publicQuoteGet',
        Effect.fn('publicQuoteGet')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          yield* limitPublicQuoteRequest(
            'read',
            payload.token,
            yield* getClientAddress(),
            PublicQuoteRateLimits.readPerMinute,
          );
          return yield* (yield* QuoteLinks)
            .get(payload.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'publicQuotePdfDownload',
        Effect.fn('publicQuotePdfDownload')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          yield* limitPublicQuoteRequest(
            'download',
            payload.token,
            yield* getClientAddress(),
            PublicQuoteRateLimits.downloadPerMinute,
          );
          const pdf = yield* (yield* QuoteLinks)
            .getPdf(payload.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `inline; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'publicQuoteSign',
        Effect.fn('publicQuoteSign')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const clientAddress = yield* getClientAddress();
          yield* limitPublicQuoteRequest(
            'signature',
            payload.token,
            clientAddress,
            PublicQuoteRateLimits.signaturePerMinute,
          );
          return yield* (yield* QuoteLinks)
            .accept(payload, {
              ipAddress: clientAddress,
              userAgent: (request.headers['user-agent'] ?? '').slice(0, 512),
            })
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
