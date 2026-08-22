import { Cache, Clock, Context, Effect, Layer, Ref } from 'effect';

interface RequestWindow {
  readonly count: number;
  readonly startedAt: number;
}

export interface RequestLimiterService {
  readonly allowRequest: (key: string, limit: number) => Effect.Effect<boolean>;
}

export class RequestLimiter extends Context.Service<RequestLimiter, RequestLimiterService>()(
  '@froment/api/RequestLimiter',
) {}

export const RequestLimiterLive = Layer.effect(
  RequestLimiter,
  Effect.gen(function* () {
    const windows = yield* Cache.make({
      capacity: 10_000,
      timeToLive: '2 minutes',
      lookup: () =>
        Clock.currentTimeMillis.pipe(
          Effect.flatMap((startedAt) => Ref.make({ count: 0, startedAt })),
        ),
    });

    const allowRequest = Effect.fn('RequestLimiter.allowRequest')(function* (
      key: string,
      limit: number,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const window = yield* Cache.get(windows, key);
      return yield* Ref.modify(window, (current): readonly [boolean, RequestWindow] => {
        if (now - current.startedAt >= 60_000) {
          return [true, { count: 1, startedAt: now }];
        }
        if (current.count >= limit) return [false, current];
        return [true, { ...current, count: current.count + 1 }];
      });
    });

    return RequestLimiter.of({ allowRequest });
  }),
);
