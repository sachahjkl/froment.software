import { Effect, Option } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';

export const getClientAddress = Effect.fn('getClientAddress')(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return Option.getOrElse(request.remoteAddress, () => 'unknown').slice(0, 64);
});
