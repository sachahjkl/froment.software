import { NodeHttpServer } from '@effect/platform-node';
import { Api } from '@froment/contracts';
import { Config, Effect, FileSystem, Layer, Option, Schema } from 'effect';
import {
  HttpEffect,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';

import { Bootstrap } from './bootstrap/bootstrap.js';
import { Authentication } from './authentication/authentication.js';
import { Clients } from './clients/clients.js';
import { Database } from './database/database.js';
import { Deployment } from './deployment/deployment.js';
import { RequestLimiter, RequestLimiterLive } from './server/request-limiter.js';

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

const protectRequest =
  (publicOrigin: string) =>
  <E, R>(application: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const mutation =
        request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS';
      if (mutation && request.url.startsWith('/api/')) {
        if (request.headers['origin'] !== publicOrigin) {
          return yield* HttpServerResponse.json(
            { code: 'request.invalid_origin' },
            { status: 403, headers: { 'cache-control': 'no-store' } },
          ).pipe(Effect.orDie);
        }
        if (request.headers['transfer-encoding'] !== undefined) {
          return yield* HttpServerResponse.json(
            { code: 'request.too_large' },
            { status: 413, headers: { 'cache-control': 'no-store' } },
          ).pipe(Effect.orDie);
        }
      }
      const contentLength = Schema.decodeUnknownOption(Schema.NumberFromString)(
        request.headers['content-length'],
      );
      if (Option.isSome(contentLength) && contentLength.value > 8 * 1024) {
        return yield* HttpServerResponse.json(
          { code: 'request.too_large' },
          { status: 413, headers: { 'cache-control': 'no-store' } },
        ).pipe(Effect.orDie);
      }
      if (mutation) {
        const clientAddress = Option.getOrElse(request.remoteAddress, () => 'unknown');
        if (!(yield* (yield* RequestLimiter).allowMutation(clientAddress))) {
          return yield* HttpServerResponse.json(
            { code: 'request.rate_limited' },
            { status: 429, headers: { 'cache-control': 'no-store' } },
          ).pipe(Effect.orDie);
        }
      }
      return yield* application.pipe(
        Effect.catch((error) => {
          if (
            !(error instanceof HttpServerError.HttpServerError) ||
            error.reason._tag !== 'RequestParseError' ||
            !(error.reason.cause instanceof Error) ||
            error.reason.cause.message !== 'maxBytes exceeded'
          ) {
            return Effect.fail(error);
          }
          return Effect.succeed(
            HttpServerResponse.jsonUnsafe(
              { code: 'request.too_large' },
              { status: 413, headers: { 'cache-control': 'no-store' } },
            ),
          );
        }),
      );
    });

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
            .login(payload.accessIdentifier, payload.mode, clientAddress)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setSessionCookies(session);
          return { authenticated: true, mode: payload.mode };
        }),
      )
      .handle(
        'sessionStatus',
        Effect.fn('sessionStatus')(function* () {
          yield* setPrivateResponseHeaders;
          const authentication = yield* Authentication;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const principal = yield* authentication
            .sessionStatus(request.cookies['__Host-froment-session'])
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
              request.cookies['__Host-froment-session'],
              request.cookies['__Host-froment-csrf'],
              request.headers['x-csrf-token'],
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

const ClientHandlers = HttpApiBuilder.group(Api, 'clients', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'clientList',
        Effect.fn('clientList')(function* () {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const authentication = yield* Authentication;
          yield* authentication
            .authorize(request.cookies['__Host-froment-session'], 'client.read', 'administrator')
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const clients = yield* Clients;
          return yield* clients.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientCreate',
        Effect.fn('clientCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const authentication = yield* Authentication;
          yield* authentication
            .authorizeWrite(
              request.cookies['__Host-froment-session'],
              request.cookies['__Host-froment-csrf'],
              request.headers['x-csrf-token'],
              request.headers['origin'],
              'client.create',
              'administrator',
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const clients = yield* Clients;
          return yield* clients
            .create(payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientArchive',
        Effect.fn('clientArchive')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const authentication = yield* Authentication;
          yield* authentication
            .authorizeWrite(
              request.cookies['__Host-froment-session'],
              request.cookies['__Host-froment-csrf'],
              request.headers['x-csrf-token'],
              request.headers['origin'],
              'client.archive',
              'administrator',
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const clients = yield* Clients;
          return yield* clients
            .archive(params.clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientAccessCreate',
        Effect.fn('clientAccessCreate')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const authentication = yield* Authentication;
          yield* authentication
            .authorizeWrite(
              request.cookies['__Host-froment-session'],
              request.cookies['__Host-froment-csrf'],
              request.headers['x-csrf-token'],
              request.headers['origin'],
              'client.access.create',
              'administrator',
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const clients = yield* Clients;
          return yield* clients
            .createAccess(params.clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(Layer.mergeAll(ApiHandlers, ClientHandlers)),
);

export const makeServerLayer = (options: {
  readonly port: number;
  readonly publicOrigin: string;
  readonly staticRoot: string;
}) => {
  const StaticRoutes = HttpStaticServer.layer({
    root: options.staticRoot,
    index: 'index.html',
  });
  const BackOfficeStaticRoutes = HttpStaticServer.layer({
    root: options.staticRoot,
    index: 'index.html',
    prefix: '/backoffice',
    spa: true,
  });

  return HttpRouter.serve(Layer.mergeAll(ApiRoutes, BackOfficeStaticRoutes, StaticRoutes), {
    middleware: protectRequest(options.publicOrigin),
  }).pipe(
    Layer.provide(RequestLimiterLive),
    Layer.provide(Layer.succeed(HttpServerRequest.MaxBodySize, FileSystem.Size(8 * 1024))),
    Layer.provide(NodeHttpServer.layer(createServer, { port: options.port })),
  );
};

export const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int('PORT').pipe(Config.withDefault(3000));
    const publicUrl = yield* Config.schema(Schema.URL, 'PUBLIC_ORIGIN');
    const staticRoot = yield* Config.string('STATIC_ROOT');
    return makeServerLayer({ port, publicOrigin: publicUrl.origin, staticRoot });
  }),
);
