import { AuthenticationRequired, LoginMode, Ulid, type LoginModeValue } from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { sign, verify } from 'paseto-ts/v4';

import { AuthenticationConfig } from './authentication-config.js';

const accessLifetime = 10 * 60 * 1_000;
const clockTolerance = 30 * 1_000;
const audience = 'froment-browser';

const AccessPayload = Schema.Struct({
  sub: Ulid,
  sid: Ulid,
  mode: LoginMode,
  type: Schema.Literal('access'),
  iss: Schema.String,
  aud: Schema.Literal(audience),
  iat: Schema.String,
  exp: Schema.String,
});

export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
  readonly mode: LoginModeValue;
}

export interface AccessTokensService {
  readonly issue: (
    claims: AccessTokenClaims,
  ) => Effect.Effect<{ readonly accessToken: string; readonly expiresAt: number }>;
  readonly verify: (token: string) => Effect.Effect<AccessTokenClaims, AuthenticationRequired>;
}

export class AccessTokens extends Context.Service<AccessTokens, AccessTokensService>()(
  '@froment/api/AccessTokens',
) {}

export const AccessTokensLive = Layer.effect(
  AccessTokens,
  Effect.gen(function* () {
    const config = yield* AuthenticationConfig;

    const issue = Effect.fn('AccessTokens.issue')(function* (claims: AccessTokenClaims) {
      const now = yield* Clock.currentTimeMillis;
      const expiresAt = now + accessLifetime;
      const accessToken = sign(
        config.pasetoSecretKey,
        {
          sub: claims.userId,
          sid: claims.sessionId,
          mode: claims.mode,
          type: 'access',
          iss: config.publicOrigin,
          aud: audience,
          iat: new Date(now).toISOString(),
          exp: new Date(expiresAt).toISOString(),
        },
        { addIat: false, addExp: false, validatePayload: false },
      );
      return { accessToken, expiresAt };
    });

    const verifyToken = Effect.fn('AccessTokens.verify')(function* (token: string) {
      const payload = yield* Effect.try({
        try: () => verify(config.pasetoPublicKey, token, { validatePayload: false }).payload,
        catch: () => new AuthenticationRequired({ code: 'authentication.required' }),
      });
      const claims = yield* Schema.decodeUnknownEffect(AccessPayload)(payload).pipe(
        Effect.mapError(() => new AuthenticationRequired({ code: 'authentication.required' })),
      );
      const now = yield* Clock.currentTimeMillis;
      const issuedAt = Date.parse(claims.iat);
      const expiresAt = Date.parse(claims.exp);
      if (
        claims.iss !== config.publicOrigin ||
        !Number.isFinite(issuedAt) ||
        !Number.isFinite(expiresAt) ||
        issuedAt > now + clockTolerance ||
        expiresAt <= now - clockTolerance ||
        expiresAt - issuedAt !== accessLifetime
      ) {
        return yield* new AuthenticationRequired({ code: 'authentication.required' });
      }
      return { userId: claims.sub, sessionId: claims.sid, mode: claims.mode };
    });

    return AccessTokens.of({ issue, verify: verifyToken });
  }),
);
