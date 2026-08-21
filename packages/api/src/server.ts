import { NodeHttpServer } from '@effect/platform-node';
import {
  Api,
  DocumentNotFound,
  RequestRateLimited,
  type InvoiceIssueRequestValue,
  type PermissionCodeValue,
  type UlidValue,
} from '@froment/contracts';
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
import { AuthenticationConfig, hmac } from './authentication/authentication-config.js';
import { Clients } from './clients/clients.js';
import { Database } from './database/database.js';
import { Deployment } from './deployment/deployment.js';
import { IssuerSettings } from './documents/issuer-settings.js';
import { DocumentArtifacts } from './documents/document-artifacts.js';
import { DocumentRenderer } from './documents/document-renderer.js';
import { InvoicePdfJobs } from './documents/invoice-pdf-jobs.js';
import { Quotes } from './quotes/quotes.js';
import { QuoteLinks } from './quotes/quote-links.js';
import { QuoteConditionPresets } from './quotes/quote-condition-presets.js';
import { Invoices } from './invoices/invoices.js';
import { Orders } from './orders/orders.js';
import { RequestLimiter, RequestLimiterLive } from './server/request-limiter.js';
import { ClientPortal } from './client-portal/client-portal.js';
import { HttpTracingLive, traceRequest } from './observability/http-tracing.js';

const sessionCookieName = '__Host-froment-session';
const csrfCookieName = '__Host-froment-csrf';
const csrfHeaderName = 'x-csrf-token';
export const issueInvoice = Effect.fn('issueInvoice')(function* (
  invoiceId: UlidValue,
  payload: InvoiceIssueRequestValue,
  actorUserId: UlidValue,
) {
  const result = yield* (yield* Invoices)
    .issue(invoiceId, payload, actorUserId)
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
  yield* (yield* InvoicePdfJobs)
    .runPending()
    .pipe(
      Effect.catch((error) => Effect.logError('Immediate invoice PDF rendering failed', error)),
    );
  return result;
});

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

const authorizeClient = Effect.fn('authorizeClient')(function* (permission: PermissionCodeValue) {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return yield* (yield* Authentication)
    .authorize(request.cookies[sessionCookieName], permission, 'client')
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
});

export const limitPublicQuoteRequest = Effect.fn('limitPublicQuoteRequest')(function* (
  route: 'read' | 'download' | 'signature',
  token: string,
  clientAddress: string,
  limit: number,
) {
  const limiter = yield* RequestLimiter;
  const config = yield* AuthenticationConfig;
  const tokenDigest = hmac(config.quoteLinkHmacKey, token).toString('hex');
  const addressAllowed = yield* limiter.allowMutation(
    `public-quote-${route}:address:${clientAddress}`,
    limit,
  );
  const tokenAllowed = yield* limiter.allowMutation(
    `public-quote-${route}:token:${tokenDigest}`,
    limit,
  );
  if (!addressAllowed || !tokenAllowed) {
    return yield* new RequestRateLimited({ code: 'request.rate_limited' });
  }
});

const getClientAddress = Effect.fn('getClientAddress')(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  return Option.getOrElse(request.remoteAddress, () => 'unknown').slice(0, 64);
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
        'clientGet',
        Effect.fn('clientGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('client.read');
          return yield* (yield* Clients)
            .get(params.clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
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
        'clientUpdate',
        Effect.fn('clientUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('client.update');
          return yield* (yield* Clients)
            .update(params.clientId, payload, principal.userId)
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

const OrderHandlers = HttpApiBuilder.group(Api, 'orders', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'orderList',
        Effect.fn('orderList')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('order.read');
          return yield* (yield* Orders).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'orderPreview',
        Effect.fn('orderPreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          yield* authorizeAdministrator('document.render');
          const snapshot = yield* (yield* Orders)
            .getSnapshot(params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* DocumentRenderer).renderOrder(snapshot).pipe(Effect.orDie);
        }),
      )
      .handle(
        'orderPdfRender',
        Effect.fn('orderPdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('document.render', 10);
          return yield* (yield* DocumentArtifacts)
            .renderOrderPdf(params.orderId, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'orderPdfDownload',
        Effect.fn('orderPdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('document.download');
          const pdf = yield* (yield* DocumentArtifacts)
            .getOrderPdf(params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      ),
  ),
);

const QuoteHandlers = HttpApiBuilder.group(Api, 'quotes', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'quoteConditionPresetList',
        Effect.fn('quoteConditionPresetList')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('quote.read');
          return yield* (yield* QuoteConditionPresets).list.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'quoteConditionPresetCreate',
        Effect.fn('quoteConditionPresetCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.update');
          return yield* (yield* QuoteConditionPresets)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteConditionPresetUpdate',
        Effect.fn('quoteConditionPresetUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.update');
          return yield* (yield* QuoteConditionPresets)
            .update(params.presetId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'quoteConditionPresetDelete',
        Effect.fn('quoteConditionPresetDelete')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('quote.update');
          return yield* (yield* QuoteConditionPresets)
            .remove(params.presetId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
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
          return yield* (yield* DocumentRenderer).renderQuote(snapshot).pipe(Effect.orDie);
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
          const quote = yield* (yield* Quotes)
            .get(params.quoteId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('QuoteNotFound', Effect.orDie),
            );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${quote.reference}-v${params.version}.pdf"`,
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
        'publicQuoteGet',
        Effect.fn('publicQuoteGet')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          yield* limitPublicQuoteRequest('read', payload.token, yield* getClientAddress(), 60);
          return yield* (yield* QuoteLinks)
            .get(payload.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'publicQuotePdfDownload',
        Effect.fn('publicQuotePdfDownload')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          yield* limitPublicQuoteRequest('download', payload.token, yield* getClientAddress(), 20);
          const pdf = yield* (yield* QuoteLinks)
            .getPdf(payload.token)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `inline; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'publicQuoteSign',
        Effect.fn('publicQuoteSign')(function* ({ payload }) {
          yield* setPublicDocumentResponseHeaders;
          const request = yield* HttpServerRequest.HttpServerRequest;
          const clientAddress = yield* getClientAddress();
          yield* limitPublicQuoteRequest('signature', payload.token, clientAddress, 10);
          return yield* (yield* QuoteLinks)
            .accept(payload, {
              ipAddress: clientAddress,
              userAgent: (request.headers['user-agent'] ?? '').slice(0, 512),
            })
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);

const InvoiceHandlers = HttpApiBuilder.group(Api, 'invoices', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'invoiceList',
        Effect.fn('invoiceList')(function* () {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('invoice.read');
          return yield* (yield* Invoices).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceGet',
        Effect.fn('invoiceGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* authorizeAdministrator('invoice.read');
          return yield* (yield* Invoices)
            .get(params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoicePreview',
        Effect.fn('invoicePreview')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          yield* authorizeAdministrator('document.render');
          const snapshot = yield* (yield* Invoices)
            .getSnapshot(params.invoiceId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return yield* (yield* DocumentRenderer).renderInvoice(snapshot).pipe(Effect.orDie);
        }),
      )
      .handle(
        'invoicePdfRender',
        Effect.fn('invoicePdfRender')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('document.render', 10);
          return yield* (yield* DocumentArtifacts)
            .renderInvoicePdf(params.invoiceId, params.version, principal.userId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('DocumentRenderError', Effect.orDie),
            );
        }),
      )
      .handle(
        'invoicePdfDownload',
        Effect.fn('invoicePdfDownload')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const invoice = yield* (yield* Invoices)
            .get(params.invoiceId)
            .pipe(
              Effect.catchTag('DatabaseError', Effect.orDie),
              Effect.catchTag('InvoiceNotFound', Effect.orDie),
            );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${invoice.invoiceNumber ?? params.invoiceId}-v${params.version}.pdf"`,
              ),
            ),
          );
          yield* authorizeAdministrator('document.download');
          return yield* (yield* DocumentArtifacts)
            .getInvoicePdf(params.invoiceId, params.version)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceCreate',
        Effect.fn('invoiceCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('invoice.create');
          return yield* (yield* Invoices)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceRevisionCreate',
        Effect.fn('invoiceRevisionCreate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('invoice.update');
          return yield* (yield* Invoices)
            .createRevision(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceIssue',
        Effect.fn('invoiceIssue')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('invoice.issue', 10);
          return yield* issueInvoice(params.invoiceId, payload, principal.userId);
        }),
      )
      .handle(
        'invoiceMarkPaid',
        Effect.fn('invoiceMarkPaid')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('invoice.mark-paid', 10);
          return yield* (yield* Invoices)
            .markPaid(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'invoiceVoid',
        Effect.fn('invoiceVoid')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeAdministratorWrite('invoice.void', 10);
          return yield* (yield* Invoices)
            .voidInvoice(params.invoiceId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);

const ClientPortalHandlers = HttpApiBuilder.group(Api, 'clientPortal', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'clientQuoteList',
        Effect.fn('clientQuoteList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('quote.read');
          return yield* (yield* ClientPortal)
            .listQuotes(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientOrderList',
        Effect.fn('clientOrderList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('order.read');
          return yield* (yield* ClientPortal)
            .listOrders(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientInvoiceList',
        Effect.fn('clientInvoiceList')(function* () {
          yield* setPrivateResponseHeaders;
          const principal = yield* authorizeClient('invoice.read');
          return yield* (yield* ClientPortal)
            .listInvoices(principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientQuotePdf',
        Effect.fn('clientQuotePdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const pdf = yield* (yield* ClientPortal)
            .getQuotePdf(principal.userId, params.quoteId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'clientInvoicePdf',
        Effect.fn('clientInvoicePdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const pdf = yield* (yield* ClientPortal)
            .getInvoicePdf(principal.userId, params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}-v${pdf.version}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      )
      .handle(
        'clientOrderPdf',
        Effect.fn('clientOrderPdf')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          yield* setDocumentResponseHeaders;
          const principal = yield* authorizeClient('document.download');
          const portal = yield* ClientPortal;
          yield* portal
            .authorizeOrder(principal.userId, params.orderId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          const pdf = yield* portal.getOrderPdf(principal.userId, params.orderId).pipe(
            Effect.catchTag('DocumentNotFound', () =>
              Effect.gen(function* () {
                yield* (yield* DocumentArtifacts).renderOrderPdf(params.orderId, null).pipe(
                  Effect.catchTag('DatabaseError', Effect.orDie),
                  Effect.catchTag('DocumentRenderError', Effect.orDie),
                  Effect.catchTag('OrderNotFound', Effect.orDie),
                  Effect.catchTag('QuotePreviewUnavailable', () =>
                    Effect.fail(new DocumentNotFound({ code: 'document.not_found' })),
                  ),
                );
                return yield* portal
                  .getOrderPdf(principal.userId, params.orderId)
                  .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
              }),
            ),
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                `attachment; filename="${pdf.reference}.pdf"`,
              ),
            ),
          );
          return pdf.content;
        }),
      ),
  ),
);

const ApiRoutes = HttpApiBuilder.layer(Api).pipe(
  Layer.provide(
    Layer.mergeAll(
      ApiHandlers,
      ClientHandlers,
      OrderHandlers,
      QuoteHandlers,
      InvoiceHandlers,
      ClientPortalHandlers,
    ),
  ),
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
    index: 'index.csr.html',
    prefix: '/backoffice',
    spa: true,
  });
  const PublicQuoteStaticRoutes = HttpStaticServer.layer({
    root: options.staticRoot,
    index: 'index.csr.html',
    prefix: '/quote',
    spa: true,
  });

  return HttpRouter.serve(
    Layer.mergeAll(ApiRoutes, BackOfficeStaticRoutes, PublicQuoteStaticRoutes, StaticRoutes),
    {
      middleware: (application) =>
        Effect.gen(function* () {
          return yield* traceRequest(
            identifyRequest(
              HttpMiddleware.logger(protectRequest(options.publicOrigin)(application)),
            ),
          );
        }),
      disableLogger: true,
    },
  ).pipe(
    Layer.provide(RequestLimiterLive),
    Layer.provide(HttpTracingLive),
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
