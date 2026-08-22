import { ApiBrowserRequest, RequestInvalidOrigin } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';

import { AuthenticationConfig } from '../authentication/authentication-config.js';

export const ApiBrowserRequestLive = Layer.effect(
  ApiBrowserRequest,
  Effect.gen(function* () {
    const config = yield* AuthenticationConfig;
    return ApiBrowserRequest.of(
      Effect.fn('ApiBrowserRequest')(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers['origin'] !== config.publicOrigin) {
          return yield* new RequestInvalidOrigin({ code: 'request.invalid_origin' });
        }
        return yield* httpEffect;
      }),
    );
  }),
);
