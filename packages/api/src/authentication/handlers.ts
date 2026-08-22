import { Api } from '@froment/contracts';
import { Effect, Option } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Authentication } from './authentication.js';
import { csrfCookieName, csrfHeaderName, sessionCookieName, setSessionCookies } from './http.js';

export const AuthenticationHandlers = HttpApiBuilder.group(Api, 'authentication', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'login',
        Effect.fn('login')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const clientAddress = Option.getOrElse(request.remoteAddress, () => 'unknown');
          const session = yield* authentication
            .login(payload.accessIdentifier, clientAddress)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies(session);
          return { authenticated: true, mode: session.mode };
        }),
      )
      .handle(
        'sessionStatus',
        Effect.fn('sessionStatus')(function* () {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const principal = yield* authentication
            .sessionStatus(request.cookies[sessionCookieName])
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          if (principal === undefined) return { authenticated: false, mode: null };
          return { authenticated: true, mode: principal.mode };
        }),
      )
      .handle(
        'logout',
        Effect.fn('logout')(function* () {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const request = yield* HttpServerRequest.HttpServerRequest;
          yield* authentication
            .logout(
              request.cookies[sessionCookieName],
              request.cookies[csrfCookieName],
              request.headers[csrfHeaderName],
              request.headers['origin'],
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies({ expiresAt: new Date(0), sessionToken: '', csrfToken: '' });
          return { authenticated: false, mode: null };
        }),
      ),
  ),
);
