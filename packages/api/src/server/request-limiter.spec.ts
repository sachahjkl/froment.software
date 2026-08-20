import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { RequestLimiter, RequestLimiterLive } from './request-limiter.js';
import { AuthenticationConfig } from '../authentication/authentication-config.js';
import { limitPublicQuoteRequest } from '../server.js';

const authenticationConfigLayer = Layer.succeed(
  AuthenticationConfig,
  AuthenticationConfig.of({
    bootstrapPasswordHash: {
      cost: 16_384,
      blockSize: 8,
      parallelization: 1,
      salt: Buffer.alloc(16),
      hash: Buffer.alloc(64),
    },
    accessHmacKey: Buffer.alloc(32, 1),
    sessionHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey: Buffer.alloc(32, 3),
    publicOrigin: 'https://example.test',
  }),
);

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

  it('limits public quote routes independently by address and token HMAC', async () => {
    const tokenA = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const tokenB = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* limitPublicQuoteRequest('read', tokenA, '192.0.2.1', 1);
        return {
          distributed: yield* Effect.result(
            limitPublicQuoteRequest('read', tokenA, '192.0.2.2', 1),
          ),
          changedToken: yield* Effect.result(
            limitPublicQuoteRequest('read', tokenB, '192.0.2.1', 1),
          ),
          separateDownload: yield* Effect.result(
            limitPublicQuoteRequest('download', tokenA, '192.0.2.1', 1),
          ),
        };
      }).pipe(Effect.provide(RequestLimiterLive), Effect.provide(authenticationConfigLayer)),
    );

    expect(result.distributed).toMatchObject({ _tag: 'Failure' });
    expect(result.changedToken).toMatchObject({ _tag: 'Failure' });
    expect(result.separateDownload).toMatchObject({ _tag: 'Success' });
  });
});
