import {
  Api,
  ApiCredentials,
  AuthenticationRequired,
  RequestRateLimited,
} from '@froment/contracts';
import { Effect } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { getClientAddress } from '../http/request.js';
import { RequestLimiter } from '../server/request-limiter.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { Authentication } from './authentication.js';
import { AuthenticationConfig, hmac } from './authentication-config.js';
import {
  clearAccessCookie,
  clearRefreshCookie,
  refreshCookieName,
  setAccessCookie,
  setRefreshCookie,
} from './http.js';

const tokenResponse = (session: {
  readonly accessToken: string;
  readonly accessExpiresAt: number;
  readonly mode: 'client' | 'administrator';
}) => ({
  expiresAt: session.accessExpiresAt,
  mode: session.mode,
});

export const AuthenticationHandlers = HttpApiBuilder.group(Api, 'authentication', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'login',
        Effect.fn('login')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const session = yield* (yield* Authentication)
            .login(payload.email, payload.password, yield* getClientAddress())
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setRefreshCookie(session);
          yield* setAccessCookie(session);
          return tokenResponse(session);
        }),
      )
      .handle(
        'refresh',
        Effect.fn('refresh')(function* () {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const refreshToken = request.cookies[refreshCookieName];
          const limiter = yield* RequestLimiter;
          const config = yield* AuthenticationConfig;
          const runtime = yield* RuntimeConfiguration;
          if (
            !(yield* limiter.allowRequest(
              `refresh:address:${yield* getClientAddress()}`,
              runtime.authentication.refreshAttemptsPerAddressPerMinute,
            ))
          ) {
            return yield* new RequestRateLimited({ code: 'request.rate_limited' });
          }
          if (refreshToken !== undefined && refreshToken.length === 43) {
            const tokenKey = hmac(config.refreshHmacKey, refreshToken).toString('hex');
            if (
              !(yield* limiter.allowRequest(
                `refresh:token:${tokenKey}`,
                runtime.authentication.refreshAttemptsPerTokenPerMinute,
              ))
            ) {
              return yield* new RequestRateLimited({ code: 'request.rate_limited' });
            }
          }
          const session = yield* (yield* Authentication).refresh(refreshToken).pipe(
            Effect.catchTag('SessionRejected', (error) =>
              clearRefreshCookie.pipe(
                Effect.andThen(clearAccessCookie),
                Effect.andThen(Effect.fail(error)),
              ),
            ),
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          if (session.refreshToken !== undefined) {
            yield* setRefreshCookie({ ...session, refreshToken: session.refreshToken });
          }
          yield* setAccessCookie(session);
          return tokenResponse(session);
        }),
      )
      .handle(
        'currentAccount',
        Effect.fn('currentAccount')(function* () {
          yield* setPrivateResponseHeaders;
          const credentials = yield* ApiCredentials;
          if (credentials.kind !== 'access-token') {
            return yield* new AuthenticationRequired({ code: 'authentication.required' });
          }
          const principal = yield* (yield* Authentication)
            .authenticate(credentials.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return { userId: principal.userId, mode: principal.mode };
        }),
      )
      .handle(
        'logout',
        Effect.fn('logout')(function* () {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          yield* (yield* Authentication).logout(request.cookies[refreshCookieName]).pipe(
            Effect.catchTag('SessionRejected', (error) =>
              clearRefreshCookie.pipe(
                Effect.andThen(clearAccessCookie),
                Effect.andThen(Effect.fail(error)),
              ),
            ),
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          yield* clearRefreshCookie;
          yield* clearAccessCookie;
        }),
      )
      .handle(
        'accountSessionsRevoke',
        Effect.fn('accountSessionsRevoke')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* (yield* Authentication)
            .revokeUserSessions(params.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
