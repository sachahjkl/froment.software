import { NodeHttpServer } from '@effect/platform-node';
import { Api, RequestRateLimited, type PermissionCodeValue } from '@froment/contracts';
import { Config, Effect, FileSystem, Layer, Option, Schema } from 'effect';
import {
  HttpEffect,
  HttpMiddleware,
  HttpRouter,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiSecurity } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

import { Bootstrap } from './bootstrap/bootstrap.js';
import { Authentication } from './authentication/authentication.js';
import { Clients } from './clients/clients.js';
import { Database } from './database/database.js';
import { Deployment } from './deployment/deployment.js';
import { IssuerSettings } from './documents/issuer-settings.js';
import { DocumentArtifacts } from './documents/document-artifacts.js';
import { QuoteRenderer } from './documents/quote-renderer.js';
import { Quotes } from './quotes/quotes.js';
import { QuoteLinks } from './quotes/quote-links.js';
import { RequestLimiter, RequestLimiterLive } from './server/request-limiter.js';

const sessionCookieName = '__Host-froment-session';
const csrfCookieName = '__Host-froment-csrf';
const csrfHeaderName = 'x-csrf-token';

const sessionCookie = HttpApiSecurity.apiKey({
  key: sessionCookieName,
  in: 'cookie',
});
const csrfCookie = HttpApiSecurity.apiKey({
  key: csrfCookieName,
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

const setDocumentResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'x-content-type-options': 'nosniff',
    }),
  ),
);

const setPublicDocumentResponseHeaders = HttpEffect.appendPreResponseHandler((_request, response) =>
  Effect.succeed(
    HttpServerResponse.setHeaders(response, {
      'cache-control': 'no-store',
      pragma: 'no-cache',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    }),
  ),
);

const containsQuoteLinkToken = (url: string) =>
  /^\/api\/public\/quote-links\/[^/?]+\/pdf(?:[?#]|$)/.test(url);

const identifyRequest = <E, R>(
  application: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.gen(function* () {
    const requestId = randomUUID();
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.succeed(HttpServerResponse.setHeader(response, 'x-request-id', requestId)),
    );
    return yield* application.pipe(
      Effect.annotateLogs({ 'request.id': requestId }),
      Effect.annotateSpans({ 'request.id': requestId }),
    );
  });

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
      if (Option.isSome(contentLength) && contentLength.value > 32 * 1024) {
        return yield* HttpServerResponse.json(
          { code: 'request.too_large' },
          { status: 413, headers: { 'cache-control': 'no-store' } },
        ).pipe(Effect.orDie);
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

const limitPrincipalMutation = Effect.fn('limitPrincipalMutation')(function* (
  userId: string,
  route: string,
  limit = 60,
) {
  if (!(yield* (yield* RequestLimiter).allowMutation(`principal:${userId}:${route}`, limit))) {
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
  }
});

const authorizeAdministrator = Effect.fn('authorizeAdministrator')(function* (
  permission: PermissionCodeValue,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* (yield* Authentication)
    .authorize(request.cookies[sessionCookieName], permission, 'administrator')
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
});

const authorizeAdministratorWrite = Effect.fn('authorizeAdministratorWrite')(function* (
  permission: PermissionCodeValue,
  limit = 60,
) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const principal = yield* (yield* Authentication)
    .authorizeWrite(
      request.cookies[sessionCookieName],
      request.cookies[csrfCookieName],
      request.headers[csrfHeaderName],
      request.headers['origin'],
      permission,
      'administrator',
    )
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
  yield* limitPrincipalMutation(principal.userId, permission, limit);
  return principal;
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

const ClientHandlers = HttpApiBuilder.group(Api, 'clients', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'clientList',
        Effect.fn('clientList')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('client.read');
          const clients = yield* Clients;
          return yield* clients.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientCreate',
        Effect.fn('clientCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('client.create');
          const clients = yield* Clients;
          return yield* clients
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientArchive',
        Effect.fn('clientArchive')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('client.archive');
          const clients = yield* Clients;
          return yield* clients
            .archive(params.clientId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientAccessCreate',
        Effect.fn('clientAccessCreate')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('client.access.create', 10);
          const clients = yield* Clients;
          return yield* clients
            .createAccess(params.clientId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);

const QuoteHandlers = HttpApiBuilder.group(Api, 'quotes', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'issuerSettingsGet',
        Effect.fn('issuerSettingsGet')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('template.read');
          return yield* (yield* IssuerSettings).get.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'issuerSettingsUpdate',
        Effect.fn('issuerSettingsUpdate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('template.select');
          return yield* (yield* IssuerSettings)
            .update(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteList',
        Effect.fn('quoteList')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('quote.read');
          return yield* (yield* Quotes).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteGet',
        Effect.fn('quoteGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('quote.read');
          return yield* (yield* Quotes)
            .get(params.quoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quotePreview',
        Effect.fn('quotePreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          yield* authorizeAdministrator('document.render');
          const snapshot = yield* (yield* Quotes)
            .getSnapshot(params.quoteId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* QuoteRenderer).render(snapshot).pipe(Effect.orDie);
        }),
      )
      .handle(
        'quotePdfRender',
        Effect.fn('quotePdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('document.render', 10);
          return yield* (yield* DocumentArtifacts)
            .renderQuotePdf(params.quoteId, params.version, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'quotePdfDownload',
        Effect.fn('quotePdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="quote-${params.quoteId}-v${params.version}.pdf"`,
              ),
            ),
          );
          yield* authorizeAdministrator('document.download');
          return yield* (yield* DocumentArtifacts)
            .getQuotePdf(params.quoteId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteCreate',
        Effect.fn('quoteCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.create');
          return yield* (yield* Quotes)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteRevisionCreate',
        Effect.fn('quoteRevisionCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.update');
          return yield* (yield* Quotes)
            .createRevision(params.quoteId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteSend',
        Effect.fn('quoteSend')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.send', 10);
          return yield* (yield* QuoteLinks)
            .send(params.quoteId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteLinkPdfDownload',
        Effect.fn('quoteLinkPdfDownload')(function* ({ params }) {
          yield* setPublicDocumentResponseHeaders;
          const pdf = yield* (yield* QuoteLinks)
            .getPdf(params.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `inline; filename="quote-${pdf.quoteId}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      ),
  ),
);

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(Layer.mergeAll(ApiHandlers, ClientHandlers, QuoteHandlers)),
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
    middleware: (application) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const observed = identifyRequest(
          HttpMiddleware.logger(protectRequest(options.publicOrigin)(application)),
        );
        if (containsQuoteLinkToken(request.url)) {
          return yield* HttpMiddleware.withLoggerDisabled(observed);
        }
        return yield* HttpMiddleware.tracer(observed);
      }),
    disableLogger: true,
  }).pipe(
    Layer.provide(RequestLimiterLive),
    Layer.provide(Layer.succeed(HttpServerRequest.MaxBodySize, FileSystem.Size(32 * 1024))),
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
