import { ApiRequestBody, RequestTooLarge } from '@froment/contracts';
import { Effect, Layer, Option, Schema } from 'effect';
import { HttpServerError, HttpServerRequest } from 'effect/unstable/http';

import { setPrivateResponseHeaders } from './response.js';
import { RuntimeConfiguration } from '../runtime-config.js';

export const ApiRequestBodyLive = Layer.effect(
  ApiRequestBody,
  Effect.gen(function* () {
    const maximumRequestBodyBytes = (yield* RuntimeConfiguration).http.maximumRequestBodyBytes;
    return ApiRequestBody.of(
      Effect.fn('ApiRequestBody')(function* (httpEffect) {
        yield* setPrivateResponseHeaders;
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers['transfer-encoding'] !== undefined) {
          return yield* new RequestTooLarge({ code: 'request.too_large' });
        }
        const contentLength = Schema.decodeUnknownOption(Schema.NumberFromString)(
          request.headers['content-length'],
        );
        if (Option.isSome(contentLength) && contentLength.value > maximumRequestBodyBytes) {
          return yield* new RequestTooLarge({ code: 'request.too_large' });
        }
        return yield* httpEffect.pipe(
          Effect.mapError((error) =>
            error instanceof HttpServerError.HttpServerError &&
            error.reason._tag === 'RequestParseError'
              ? new RequestTooLarge({ code: 'request.too_large' })
              : error,
          ),
        );
      }),
    );
  }),
);
