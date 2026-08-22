import { Context, Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';

import type { Endpoint } from './endpoint.js';

export const RateLimits = {
  sixtyPerMinute: 60,
  tenPerMinute: 10,
} as const;
export type RateLimit = (typeof RateLimits)[keyof typeof RateLimits];

export class EndpointRateLimit extends Context.Service<EndpointRateLimit, RateLimit>()(
  '@froment/contracts/EndpointRateLimit',
) {}

export const rateLimit =
  (limit: RateLimit) =>
  <
    Identifier extends string,
    Method extends HttpMethod.HttpMethod,
    Path extends string,
    Params extends Schema.Top,
    Query extends Schema.Top,
    Payload extends Schema.Top,
    Headers extends Schema.Top,
    Success extends Schema.Top,
    Error extends Schema.Top,
    Middleware,
    MiddlewareServices,
  >(
    endpoint: Endpoint<
      Identifier,
      Method,
      Path,
      Params,
      Query,
      Payload,
      Headers,
      Success,
      Error,
      Middleware,
      MiddlewareServices
    >,
  ) =>
    endpoint.annotate(EndpointRateLimit, limit);
