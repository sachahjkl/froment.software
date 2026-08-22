import { Api } from '@froment/contracts';
import { Effect, Option } from 'effect';
import { HttpServerRequest } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { Authentication } from '../authentication/authentication.js';
import {
  csrfCookieName,
  csrfHeaderName,
  sessionCookieName,
  setSessionCookies,
} from '../authentication/http.js';
import { Bootstrap } from '../bootstrap/bootstrap.js';
import { Database } from '../database/database.js';
import { Deployment } from '../deployment/deployment.js';
import { setPrivateResponseHeaders } from '../http/response.js';

export const SystemHandlers = HttpApiBuilder.group(Api, 'system', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'health',
        Effect.fn('health')(function* () {
          const database = yield* Database;
          yield* Effect.sync(() => database.sqlite.prepare('select 1').get());
          return { status: 'ok' as const };
        }),
      )
      .handle(
        'version',
        Effect.fn('version')(function* () {
          yield* setPrivateResponseHeaders;
          return (yield* Deployment).metadata;
        }),
      )
      .handle(
        'bootstrapStatus',
        Effect.fn('bootstrapStatus')(function* () {
          yield* setPrivateResponseHeaders;
          const bootstrap = yield* Bootstrap;
          return { available: yield* bootstrap.isAvailable.pipe(Effect.orDie) };
        }),
      )
      .handle(
        'bootstrapCreate',
        Effect.fn('bootstrapCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const bootstrap = yield* Bootstrap;
          const session = yield* bootstrap
            .create(payload.password)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies(session);
          return {
            accessIdentifier: session.accessIdentifier,
          };
        }),
      )
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
          const expired = { expiresAt: new Date(0), sessionToken: '', csrfToken: '' };
          yield* setSessionCookies(expired);
          return { authenticated: false, mode: null };
        }),
      ),
  ),
);
