import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { RequestLimiter, RequestLimiterLive } from './request-limiter.js';

describe('RequestLimiter', () => {
  it('renews the mutation allowance after one minute', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        const allowed = yield* Effect.forEach(
          Array.from({ length: 120 }),
          () => limiter.allowMutation('127.0.0.1', 120),
          { discard: true },
        );
        const blocked = yield* limiter.allowMutation('127.0.0.1', 120);
        yield* TestClock.adjust('1 minute');
        const renewed = yield* limiter.allowMutation('127.0.0.1', 120);
        return { allowed, blocked, renewed };
      }).pipe(Effect.provide(RequestLimiterLive), Effect.provide(TestClock.layer())),
    );

    expect(result).toEqual({ allowed: undefined, blocked: false, renewed: true });
  });

  it('keeps independent limits for each principal route', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        yield* limiter.allowMutation('principal:user:client.access.create', 1);
        return {
          sameRoute: yield* limiter.allowMutation('principal:user:client.access.create', 1),
          otherRoute: yield* limiter.allowMutation('principal:user:quote.create', 1),
          otherUser: yield* limiter.allowMutation('principal:other:client.access.create', 1),
        };
      }).pipe(Effect.provide(RequestLimiterLive), Effect.provide(TestClock.layer())),
    );

    expect(result).toEqual({ sameRoute: false, otherRoute: true, otherUser: true });
  });
});
