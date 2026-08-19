import { NodeHttpServer } from '@effect/platform-node';
import { Api } from '@froment/contracts';
import { Config, Effect, FileSystem, Layer } from 'effect';
import {
  HttpEffect,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';

import { Bootstrap } from './bootstrap/bootstrap.js';
import { Authentication } from './authentication/authentication.js';
import { Database } from './database/database.js';

const sessionCookie = HttpApiSecurity.apiKey({
  key: '__Host-froment-session',
  in: 'cookie',
});
const csrfCookie = HttpApiSecurity.apiKey({
  key: '__Host-froment-csrf',
  in: 'cookie',
});

const setPrivateResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'cache-control': 'no-store',
      pragma: 'no-cache',
      vary: 'Cookie',
    }),
  ),
);

const setSessionCookies = (session: {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly expiresAt: Date;
}) =>
  Effect.gen(function* () {
    const cookieOptions = {
      expires: session.expiresAt,
      path: '/',
      sameSite: 'strict' as const,
    };
    yield* HttpApiBuilder.securitySetCookie(sessionCookie, session.sessionToken, cookieOptions);
    yield* HttpApiBuilder.securitySetCookie(csrfCookie, session.csrfToken, {
      ...cookieOptions,
      httpOnly: false,
    });
  });

const ApiHandlers = HttpApiBuilder.group(Api, 'system', (handlers) =>
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
            administratorId: session.administratorId,
            accessIdentifier: session.accessIdentifier,
          };
        }),
      )
      .handle(
        'login',
        Effect.fn('login')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const session = yield* authentication
            .login(payload.accessIdentifier, payload.mode)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies(session);
          return { authenticated: true };
        }),
      )
      .handle(
        'sessionStatus',
        Effect.fn('sessionStatus')(function* () {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const authenticated = yield* authentication
            .sessionStatus(request.cookies['__Host-froment-session'])
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return { authenticated };
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
              request.cookies['__Host-froment-session'],
              request.cookies['__Host-froment-csrf'],
              request.headers['x-csrf-token'],
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const expired = { expiresAt: new Date(0), sessionToken: '', csrfToken: '' };
          yield* setSessionCookies(expired);
          return { authenticated: false };
        }),
      ),
  ),
);

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(Layer.provide(ApiHandlers));

export const makeServerLayer = (options: {
  readonly port: number;
  readonly staticRoot: string;
}) => {
  const StaticRoutes = HttpStaticServer.layer({
    root: options.staticRoot,
    index: 'index.html',
  });

  return HttpRouter.serve(Layer.mergeAll(ApiRoutes, StaticRoutes)).pipe(
    Layer.provide(Layer.succeed(HttpServerRequest.MaxBodySize, FileSystem.Size(8 * 1024))),
    Layer.provide(NodeHttpServer.layer(createServer, { port: options.port })),
  );
};

export const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int('PORT').pipe(Config.withDefault(3000));
    const staticRoot = yield* Config.string('STATIC_ROOT');
    return makeServerLayer({ port, staticRoot });
  }),
);
