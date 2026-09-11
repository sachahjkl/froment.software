import { Context, Effect, Layer } from 'effect';

import { RuntimeConfiguration } from '../runtime-config.js';
import * as RequestQuota from './request-quota.js';

export interface RequestLimiterService {
  readonly allowRequest: (key: string, limit: number) => Effect.Effect<boolean>;
  readonly allowPublicRequest: (key: string, limit: number) => Effect.Effect<boolean>;
}

export class RequestLimiter extends Context.Service<RequestLimiter, RequestLimiterService>()(
  '@froment/api/RequestLimiter',
) {}

export const RequestLimiterLive = Layer.effect(
  RequestLimiter,
  Effect.gen(function* () {
    const config = (yield* RuntimeConfiguration).requestLimiter;
    const reserve = yield* RequestQuota.make(config);
    const reservePublic = yield* RequestQuota.make({
      capacity: config.publicCapacity,
      windowMillis: config.windowMillis,
    });
    return RequestLimiter.of({
      allowRequest: (key, limit) => reserve([key], limit),
      allowPublicRequest: (key, limit) => reservePublic([key], limit),
    });
  }),
);
