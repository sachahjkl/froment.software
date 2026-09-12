import { ApiRequestBody, RequestBodyKind, RequestTooLarge } from '@froment/contracts';
import { Context, Effect, FileSystem, Layer, Option, Schema } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';

import { setPrivateResponseHeaders } from './response.js';
import { RuntimeConfiguration } from '../runtime-config.js';

export const ApiRequestBodyLive = Layer.effect(
  ApiRequestBody,
  Effect.gen(function* () {
    const config = (yield* RuntimeConfiguration).http;
    return ApiRequestBody.of(
      Effect.fn('ApiRequestBody')(function* (httpEffect, { endpoint }) {
        const bodyKind = Context.get(endpoint.annotations, RequestBodyKind);
        const maximumRequestBodyBytes =
          bodyKind === 'bank-import'
            ? config.maximumBankImportBodyBytes
            : bodyKind === 'supplier-invoice-analysis'
              ? config.maximumSupplierInvoiceAnalysisBodyBytes
              : config.maximumRequestBodyBytes;
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
        const text = yield* request.text.pipe(
          Effect.provideService(
            HttpServerRequest.MaxBodySize,
            FileSystem.Size(maximumRequestBodyBytes),
          ),
          Effect.mapError(() => new RequestTooLarge({ code: 'request.too_large' })),
        );
        if (Buffer.byteLength(text, 'utf8') > maximumRequestBodyBytes) {
          return yield* new RequestTooLarge({ code: 'request.too_large' });
        }
        return yield* httpEffect.pipe(
          Effect.provideService(
            HttpServerRequest.MaxBodySize,
            FileSystem.Size(maximumRequestBodyBytes),
          ),
        );
      }),
    );
  }),
);
