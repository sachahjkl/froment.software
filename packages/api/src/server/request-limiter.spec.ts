import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { describe, expect, it } from 'vitest';

import { RequestLimiter, RequestLimiterLive } from './request-limiter.js';
import { AuthenticationConfig } from '../authentication/authentication-config.js';
import { limitPublicQuoteRequest } from '../quote-links/request-limit.js';
import {
  defaultRuntimeConfig,
  RuntimeConfiguration,
  RuntimeConfigurationDefaults,
} from '../runtime-config.js';

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
    pasetoSecretKey:
      'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA',
    pasetoPublicKey: 'k4.public.nLs-Lm0nP2S86EJThJ6foAzKXYxYE8KdJhxvCz9kLhQ',
    apiTokenHmacKey: Buffer.alloc(32, 4),
    refreshHmacKey: Buffer.alloc(32, 2),
    quoteLinkHmacKey: Buffer.alloc(32, 3),
    publicOrigin: 'https://example.test',
  }),
);
const publicQuoteRuntimeLayer = Layer.succeed(RuntimeConfiguration, {
  ...defaultRuntimeConfig,
  publicQuote: {
    ...defaultRuntimeConfig.publicQuote,
    readPerMinute: 1,
    downloadPerMinute: 1,
    signaturePerMinute: 1,
  },
});

describe('RequestLimiter', () => {
  it('refuses new keys at capacity without evicting active counters', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        expect(yield* limiter.allowRequest('protected', 1)).toBe(true);
        expect(yield* limiter.allowRequest('other', 2)).toBe(true);
        expect(yield* limiter.allowRequest('new', 1)).toBe(false);
        expect(yield* limiter.allowRequest('other', 2)).toBe(true);
        expect(yield* limiter.allowRequest('protected', 1)).toBe(false);
        yield* TestClock.adjust('1 minute');
        expect(yield* limiter.allowRequest('new', 1)).toBe(true);
        expect(yield* limiter.allowRequest('protected', 1)).toBe(true);
      }).pipe(
        Effect.provide(RequestLimiterLive),
        Effect.provideService(RuntimeConfiguration, {
          ...defaultRuntimeConfig,
          requestLimiter: { ...defaultRuntimeConfig.requestLimiter, capacity: 2 },
        }),
        Effect.provide(TestClock.layer()),
      ),
    );
  });

  it('does not create token keys after address refusal or reset protected quotas', async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        expect(yield* limiter.allowRequest('password-change:user', 1)).toBe(true);
        yield* limitPublicQuoteRequest('read', 'first', '192.0.2.1');
        for (let index = 0; index < 8; index++) {
          expect(
            yield* Effect.result(limitPublicQuoteRequest('read', `token-${index}`, '192.0.2.1')),
          ).toMatchObject({ _tag: 'Failure', failure: { _tag: 'RequestRateLimited' } });
        }
        // Two public slots remain because refused addresses created no token keys.
        yield* limitPublicQuoteRequest('read', 'second', '192.0.2.2');
        expect(yield* limiter.allowPublicRequest('overflow', 1)).toBe(false);
        expect(yield* limiter.allowRequest('password-change:user', 1)).toBe(false);
        expect(yield* limiter.allowRequest('other-user', 1)).toBe(true);
      }).pipe(
        Effect.provide(RequestLimiterLive),
        Effect.provide(authenticationConfigLayer),
        Effect.provideService(RuntimeConfiguration, {
          ...defaultRuntimeConfig,
          requestLimiter: {
            ...defaultRuntimeConfig.requestLimiter,
            capacity: 2,
            publicCapacity: 4,
          },
          publicQuote: { ...defaultRuntimeConfig.publicQuote, readPerMinute: 1 },
        }),
        Effect.provide(TestClock.layer()),
      ),
    );
  });

  it('renews the mutation allowance after one minute', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        const allowed = yield* Effect.forEach(
          Array.from({ length: 120 }),
          () => limiter.allowRequest('127.0.0.1', 120),
          { discard: true },
        );
        const blocked = yield* limiter.allowRequest('127.0.0.1', 120);
        yield* TestClock.adjust('1 minute');
        const renewed = yield* limiter.allowRequest('127.0.0.1', 120);
        return { allowed, blocked, renewed };
      }).pipe(
        Effect.provide(RequestLimiterLive),
        Effect.provide(RuntimeConfigurationDefaults),
        Effect.provide(TestClock.layer()),
      ),
    );

    expect(result).toEqual({ allowed: undefined, blocked: false, renewed: true });
  });

  it('keeps independent limits for each principal route', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const limiter = yield* RequestLimiter;
        yield* limiter.allowRequest('principal:user:client.access.create', 1);
        return {
          sameRoute: yield* limiter.allowRequest('principal:user:client.access.create', 1),
          otherRoute: yield* limiter.allowRequest('principal:user:quote.create', 1),
          otherUser: yield* limiter.allowRequest('principal:other:client.access.create', 1),
        };
      }).pipe(
        Effect.provide(RequestLimiterLive),
        Effect.provide(RuntimeConfigurationDefaults),
        Effect.provide(TestClock.layer()),
      ),
    );

    expect(result).toEqual({ sameRoute: false, otherRoute: true, otherUser: true });
  });

  it('limits public quote routes independently by address and token HMAC', async () => {
    const tokenA = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const tokenB = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* limitPublicQuoteRequest('read', tokenA, '192.0.2.1');
        return {
          distributed: yield* Effect.result(limitPublicQuoteRequest('read', tokenA, '192.0.2.2')),
          changedToken: yield* Effect.result(limitPublicQuoteRequest('read', tokenB, '192.0.2.1')),
          separateDownload: yield* Effect.result(
            limitPublicQuoteRequest('download', tokenA, '192.0.2.1'),
          ),
        };
      }).pipe(
        Effect.provide(RequestLimiterLive),
        Effect.provide(authenticationConfigLayer),
        Effect.provide(publicQuoteRuntimeLayer),
      ),
    );

    expect(result.distributed).toMatchObject({ _tag: 'Failure' });
    expect(result.changedToken).toMatchObject({ _tag: 'Failure' });
    expect(result.separateDownload).toMatchObject({ _tag: 'Success' });
  });
});
