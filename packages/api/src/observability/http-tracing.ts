import { Effect, Layer } from 'effect';
import {
  Headers,
  HttpMiddleware,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http';

import { RequestContext } from '../http/request-context.js';

const redactedHeaderNames = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

export const traceRequest = <E, R>(
  application: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | R
  >,
) => HttpMiddleware.tracer(application);

export const logRequest = <E, R>(
  application: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | RequestContext | R
  >,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const requestContext = yield* RequestContext;
    const exit = yield* Effect.exit(application);
    const response = HttpServerError.exitResponse(exit);
    const apiTelemetry = requestContext.apiTelemetry();
    const annotations = {
      'http.method': request.method,
      'http.route': apiTelemetry?.route ?? request.url.split(/[?#]/, 1)[0],
      'http.status': response.status,
    };
    const log =
      apiTelemetry !== undefined
        ? Effect.logInfo('http.response.sent')
        : response.status >= 400
          ? Effect.logWarning('http.response.sent')
          : Effect.logDebug('http.response.sent');
    yield* Effect.annotateLogs(
      log,
      apiTelemetry === undefined
        ? annotations
        : { ...annotations, 'api.operation': apiTelemetry.operation },
    );
    return yield* exit;
  });

export const HttpTracingLive = Layer.succeed(Headers.CurrentRedactedNames, redactedHeaderNames);
