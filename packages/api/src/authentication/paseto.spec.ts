import { Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import { sign } from 'paseto-ts/v4';
import { describe, expect, it } from 'vitest';

import { AuthenticationConfig } from './authentication-config.js';
import { AccessTokens, AccessTokensLive } from './paseto.js';

const configLayer = (publicOrigin = 'https://example.test') =>
  Layer.succeed(
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
      apiTokenHmacKey: Buffer.alloc(32, 1),
      refreshHmacKey: Buffer.alloc(32, 2),
      quoteLinkHmacKey: Buffer.alloc(32, 3),
      publicOrigin,
    }),
  );

const accessLayer = (publicOrigin?: string) =>
  AccessTokensLive.pipe(Layer.provide(configLayer(publicOrigin)));

const secretKey =
  'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA';
interface TestPayload {
  readonly sub: string;
  readonly sid: string | number;
  readonly mode: string;
  readonly type: string;
  readonly iss: string;
  readonly aud: string;
  readonly iat: string;
  readonly exp: string;
}
const signedToken = (payload: TestPayload) =>
  sign(secretKey, payload, { addIat: false, addExp: false, validatePayload: false });

describe('AccessTokens', () => {
  it('issues and verifies a ten-minute v4.public access token', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const tokens = yield* AccessTokens;
        const issued = yield* tokens.issue({
          userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
          sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
          mode: 'administrator',
        });
        return { issued, claims: yield* tokens.verify(issued.accessToken) };
      }).pipe(Effect.provide(accessLayer()), Effect.provide(TestClock.layer())),
    );

    expect(result.issued.accessToken).toMatch(/^v4\.public\./);
    expect(result.issued.expiresAt).toBe(2_000_000_600_000);
    expect(result.claims).toEqual({
      userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
      sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
      mode: 'administrator',
    });
  });

  it('rejects malformed tokens and tokens from another issuer', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const issued = yield* (yield* AccessTokens).issue({
          userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
          sessionId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
          mode: 'client',
        });
        return issued.accessToken;
      }).pipe(
        Effect.provide(accessLayer('https://issuer.test')),
        Effect.provide(TestClock.layer()),
      ),
    );

    const failures = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(2_000_000_000_000);
        const tokens = yield* AccessTokens;
        return yield* Effect.all([
          Effect.result(tokens.verify('v4.public.invalid')),
          Effect.result(tokens.verify(result)),
        ]);
      }).pipe(Effect.provide(accessLayer()), Effect.provide(TestClock.layer())),
    );
    for (const failure of failures) {
      expect(failure).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'AuthenticationRequired' },
      });
    }
  });

  it('rejects every access-token claim and signature boundary', async () => {
    const now = 2_000_000_000_000;
    const valid = {
      sub: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
      sid: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
      mode: 'administrator',
      type: 'access',
      iss: 'https://example.test',
      aud: 'froment-browser',
      iat: new Date(now).toISOString(),
      exp: new Date(now + 600_000).toISOString(),
    };
    const token = signedToken(valid);
    const invalidTokens = [
      signedToken({ ...valid, aud: 'another-audience' }),
      signedToken({ ...valid, type: 'refresh' }),
      signedToken({ ...valid, iat: new Date(now + 31_000).toISOString() }),
      signedToken({ ...valid, exp: new Date(now - 31_000).toISOString() }),
      signedToken({ ...valid, exp: new Date(now + 599_999).toISOString() }),
      signedToken({ ...valid, sid: 42 }),
      `v3.public.${token.slice('v4.public.'.length)}`,
      `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`,
    ];

    const failures = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        const tokens = yield* AccessTokens;
        return yield* Effect.forEach(invalidTokens, (candidate) =>
          Effect.result(tokens.verify(candidate)),
        );
      }).pipe(Effect.provide(accessLayer()), Effect.provide(TestClock.layer())),
    );
    for (const failure of failures) {
      expect(failure).toMatchObject({
        _tag: 'Failure',
        failure: { _tag: 'AuthenticationRequired' },
      });
    }
  });
});
