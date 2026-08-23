import { Effect, Layer } from 'effect';
import {
  Headers,
  HttpMiddleware,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http';

import { RequestContext } from '../http/request-context.js';

const redactedHeaderNames = [
  /^(?!(?:accept|cache-control|content-length|content-type|host|traceparent|user-agent|x-forwarded-host|x-forwarded-proto|x-request-id)$).*/i,
];

export const traceRequest = <E, R>(
  application: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | R
  >,
) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const tracedRequest = request.modify({ url: request.url.split(/[?#]/, 1)[0] });
    return yield* HttpMiddleware.tracer(
      Effect.provideService(application, HttpServerRequest.HttpServerRequest, request),
    ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, tracedRequest));
  });

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
    for (const event of requestContext.recordedAuditEvents()) {
      if (!event.isCommitted()) continue;
      const eventAnnotations = {
        'audit.event.id': event.id,
        'audit.action': event.action,
        'resource.type': event.resourceType,
        'resource.id': event.resourceId,
      };
      yield* Effect.annotateLogs(
        Effect.logInfo('audit.event.recorded'),
        event.actorUserId === null
          ? eventAnnotations
          : { ...eventAnnotations, 'actor.user.id': event.actorUserId },
      );
    }
    return yield* exit;
  });

export const HttpTracingLive = Layer.succeed(Headers.CurrentRedactedNames, redactedHeaderNames);
