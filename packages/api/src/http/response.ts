import { Effect } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { randomUUID } from 'node:crypto';

export const setPrivateResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'cache-control': 'no-store',
      pragma: 'no-cache',
      vary: 'Cookie, Authorization',
    }),
  ),
);

export const setDocumentResponseHeaders = HttpEffect.appendPreResponseHandler(
  (_request, response) =>
    Effect.succeed(
      HttpServerResponse.setHeaders(response, {
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
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
  application: Effect.Effect<HttpServerResponse.HttpServerResponse, Error, Requirements>,
) =>
  Effect.gen(function* () {
    const requestId = randomUUID();
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(HttpServerResponse.setHeader(response, 'x-request-id', requestId)),
    );
    return yield* application.pipe(
      Effect.annotateLogs({ 'request.id': requestId }),
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
