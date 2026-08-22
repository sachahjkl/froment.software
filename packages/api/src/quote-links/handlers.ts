import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { getClientAddress } from '../http/request.js';
import {
  setDownloadName,
  setPrivateResponseHeaders,
  setPublicDocumentResponseHeaders,
} from '../http/response.js';
import { limitPublicQuoteRequest, PublicQuoteRateLimits } from './request-limit.js';
import { QuoteLinks } from './service.js';

export const QuoteLinkHandlers = HttpApiBuilder.group(Api, 'quoteLinks', (handlers) =>
  Effect.succeed(
    handlers
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
          yield* setDownloadName(`${pdf.reference}-v${pdf.version}.pdf`, 'inline');
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
