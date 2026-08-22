import { Effect, Layer } from 'effect';
import {
  Headers,
  HttpMiddleware,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http';

const redactedHeaderNames = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];

export const traceRequest = <E, R>(
  application: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | R
  >,
) => HttpMiddleware.tracer(application);

export const HttpTracingLive = Layer.succeed(Headers.CurrentRedactedNames, redactedHeaderNames);
