import {
  Api,
  ApiCredentials,
  AuthenticationRequired,
  RequestRateLimited,
} from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';
import { getClientAddress } from '../http/request.js';
import { setPrivateResponseHeaders } from '../http/response.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { Authentication } from './authentication.js';
import { setAccessCookie, setRefreshCookie } from './http.js';
import { Passkeys, PasskeysLive } from './passkeys.js';

const challengeCookieName = '__Secure-froment-passkey';
const challengeCookie = HttpApiSecurity.apiKey({ key: challengeCookieName, in: 'cookie' });
const setChallenge = (id: string) =>
  HttpApiBuilder.securitySetCookie(challengeCookie, id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/api/auth/passkeys',
    maxAge: '5 minutes',
  });
const principal = Effect.gen(function* () {
  const credentials = yield* ApiCredentials;
  if (credentials.kind !== 'access-token')
    return yield* new AuthenticationRequired({ code: 'authentication.required' });
  return yield* (yield* Authentication)
    .authenticate(credentials.token)
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
});
const limit = Effect.gen(function* () {
  yield* setPrivateResponseHeaders;
  if (!(yield* (yield* RequestLimiter).allowRequest(`passkeys:${yield* getClientAddress()}`, 20)))
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
});
const challengeId = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  yield* setChallenge('');
  return request.cookies[challengeCookieName] ?? '';
});

export const PasskeyHandlers = HttpApiBuilder.group(Api, 'passkeys', (handlers) =>
  Effect.gen(function* () {
    const passkeys = yield* Passkeys;
    return handlers
      .handle(
        'passkeyList',
        Effect.fn('passkeyList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* passkeys
            .list(yield* principal)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'passkeyRegisterOptions',
        Effect.fn('passkeyRegisterOptions')(function* ({ payload }) {
          yield* limit;
          const prepared = yield* passkeys
            .registerOptions(yield* principal, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setChallenge(prepared.id);
          return prepared.options;
        }),
      )
      .handle(
        'passkeyRegisterVerify',
        Effect.fn('passkeyRegisterVerify')(function* ({ payload }) {
          yield* limit;
          yield* passkeys
            .register(yield* principal, yield* challengeId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'passkeyRemove',
        Effect.fn('passkeyRemove')(function* ({ params, payload }) {
          yield* limit;
          yield* passkeys
            .remove(yield* principal, params.passkeyId, payload.password)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'passkeyLoginOptions',
        Effect.fn('passkeyLoginOptions')(function* () {
          yield* limit;
          const prepared = yield* passkeys.loginOptions.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          yield* setChallenge(prepared.id);
          return prepared.options;
        }),
      )
      .handle(
        'passkeyLoginVerify',
        Effect.fn('passkeyLoginVerify')(function* ({ payload }) {
          yield* limit;
          const session = yield* passkeys
            .login(yield* challengeId, payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setAccessCookie(session);
          yield* setRefreshCookie(session);
          return { expiresAt: session.accessExpiresAt, mode: session.mode };
        }),
      );
  }),
).pipe(Layer.provide(PasskeysLive));
