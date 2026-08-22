import { Api, ApiCredentials, AuthenticationRequired } from '@froment/contracts';
import { Effect, Option } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Authentication } from './authentication.js';
import { clearRefreshCookie, refreshCookieName, setRefreshCookie } from './http.js';

const tokenResponse = (session: {
  readonly accessToken: string;
  readonly accessExpiresAt: number;
  readonly mode: 'client' | 'administrator';
}) => ({
  accessToken: session.accessToken,
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
          const request = yield* HttpServerRequest.HttpServerRequest;
          const session = yield* (yield* Authentication)
            .login(
              payload.email,
              payload.password,
              Option.getOrElse(request.remoteAddress, () => 'unknown'),
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setRefreshCookie(session);
          return tokenResponse(session);
        }),
      )
      .handle(
        'refresh',
        Effect.fn('refresh')(function* () {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const session = yield* (yield* Authentication)
            .refresh(request.cookies[refreshCookieName])
            .pipe(
              Effect.catchTag('SessionRejected', (error) =>
                clearRefreshCookie.pipe(Effect.andThen(Effect.fail(error))),
              ),
              Effect.catchTag('DatabaseError', Effect.orDie),
            );
          yield* setRefreshCookie(session);
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
              clearRefreshCookie.pipe(Effect.andThen(Effect.fail(error))),
            ),
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          yield* clearRefreshCookie;
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
