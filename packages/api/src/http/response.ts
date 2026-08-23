import { Effect } from 'effect';
import { HttpEffect, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
import { randomUUID } from 'node:crypto';

import {
  type ApiRequestTelemetry,
  type RecordedAuditEvent,
  RequestContext,
} from './request-context.js';

export const setPrivateResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'cache-control': 'no-store',
      pragma: 'no-cache',
      vary: 'Cookie, Authorization',
    }),
  ),
);

export const preventHtmlCaching = <Error, Requirements>(
  application: Effect.Effect<HttpServerResponse.HttpServerResponse, Error, Requirements>,
) =>
  Effect.gen(function* () {
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(
        response.headers['content-type']?.startsWith('text/html')
          ? HttpServerResponse.setHeaders(response, {
              'cache-control': 'no-store',
              pragma: 'no-cache',
            })
          : response,
      ),
    );
    return yield* application;
  });

export const setPdfResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
    }),
  ),
);

export const setPublicDocumentResponseHeaders = HttpEffect.appendPreResponseHandler(
  (_request, response) =>
    Effect.succeed(
      HttpServerResponse.setHeaders(response, {
        'cache-control': 'no-store',
        pragma: 'no-cache',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
      }),
    ),
);

export const identifyRequest = <Error, Requirements>(
  application: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    Error,
    RequestContext | Requirements
  >,
): Effect.Effect<
  HttpServerResponse.HttpServerResponse,
  Error,
  HttpServerRequest.HttpServerRequest | Exclude<Requirements, RequestContext>
> =>
  Effect.gen(function* () {
    const requestId = randomUUID();
    const span = yield* Effect.orDie(Effect.currentParentSpan);
    let apiTelemetry: ApiRequestTelemetry | undefined;
    const recordedAuditEvents: Array<RecordedAuditEvent> = [];
    const requestContext = RequestContext.of({
      requestId,
      traceId: span.traceId,
      spanId: span.spanId,
      apiTelemetry: () => apiTelemetry,
      setApiTelemetry: (value) => {
        apiTelemetry = value;
      },
      recordedAuditEvents: () => recordedAuditEvents,
      recordAuditEvent: (event) => {
        recordedAuditEvents.push(event);
      },
    });
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(HttpServerResponse.setHeader(response, 'x-request-id', requestId)),
    );
    return yield* application.pipe(
      Effect.provideService(RequestContext, requestContext),
      Effect.annotateLogs({
        'request.id': requestId,
        'trace.id': span.traceId,
        'span.id': span.spanId,
      }),
      Effect.annotateSpans({ 'request.id': requestId }),
    );
  });

export const setDownloadName = (fileName: string, disposition: 'attachment' | 'inline') =>
  HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.succeed(
      HttpServerResponse.setHeader(
        response,
        'content-disposition',
        `${disposition}; filename="${fileName}"`,
      ),
    ),
  );
