import { NodeHttpServer } from '@effect/platform-node';
import { Config, Effect, FileSystem, Layer, Schema } from 'effect';
import {
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from 'effect/unstable/http';
import { HttpApiBuilder, HttpApiScalar, OpenApi } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';

import { AuthenticationHttpLive } from './authentication/http.js';
import { AuthenticationHandlers } from './authentication/handlers.js';
import { AffairHandlers } from './affairs/handlers.js';
import { BootstrapHandlers } from './bootstrap/handlers.js';
import { ClientPortalHandlers } from './client-portal/handlers.js';
import { ClientHandlers } from './clients/handlers.js';
import { apiForLanguage } from './documentation/api-documentation.js';
import { HttpTracingLive, traceRequest } from './observability/http-tracing.js';
import { identifyRequest, preventHtmlCaching } from './http/response.js';
import { ApiBrowserRequestLive } from './http/origin.js';
import { ApiRequestBodyLive } from './http/request-body.js';
import { IpAddress, TrustedProxyAddresses } from './http/request.js';
import { ApiTokenHandlers } from './api-tokens/handlers.js';
import { InvoiceHandlers } from './invoices/handlers.js';
import { IssuerSettingsHandlers } from './issuer-settings/handlers.js';
import { OrderHandlers } from './orders/handlers.js';
import { QuoteHandlers } from './quotes/handlers.js';
import { QuoteConditionPresetHandlers } from './quote-condition-presets/handlers.js';
import { QuoteLinkHandlers } from './quote-links/handlers.js';
import { RequestLimiterLive } from './server/request-limiter.js';
import { StatusHandlers } from './status/handlers.js';
import { RuntimeConfiguration } from './runtime-config.js';

const FrenchApi = apiForLanguage('fr');
const EnglishApi = apiForLanguage('en');

const ApiRoutes = HttpApiBuilder.layer(FrenchApi, { openapiPath: '/api/openapi.json' }).pipe(
  Layer.provide(
    Layer.mergeAll(
      StatusHandlers,
      BootstrapHandlers,
      AuthenticationHandlers,
      ClientHandlers,
      OrderHandlers,
      QuoteConditionPresetHandlers,
      IssuerSettingsHandlers,
      AffairHandlers,
      QuoteHandlers,
      QuoteLinkHandlers,
      InvoiceHandlers,
      ClientPortalHandlers,
      ApiTokenHandlers,
    ),
  ),
  Layer.provide(Layer.mergeAll(AuthenticationHttpLive, ApiBrowserRequestLive, ApiRequestBodyLive)),
);

const frenchScalar = { showOperationId: true, localization: { locale: 'fr' } };
const englishScalar = { showOperationId: true, localization: { locale: 'en' } };
const ApiDocs = HttpApiScalar.layer(FrenchApi, {
  path: '/api/docs',
  scalar: frenchScalar,
});
const FrenchApiDocs = HttpApiScalar.layer(FrenchApi, {
  path: '/api/docs/fr',
  scalar: frenchScalar,
});
const EnglishApiDocs = HttpApiScalar.layer(EnglishApi, {
  path: '/api/docs/en',
  scalar: englishScalar,
});
const LocalizedOpenApiRoutes = Layer.mergeAll(
  HttpRouter.add(
    'GET',
    '/api/openapi.fr.json',
    HttpServerResponse.jsonUnsafe(OpenApi.fromApi(FrenchApi)),
  ),
  HttpRouter.add(
    'GET',
    '/api/openapi.en.json',
    HttpServerResponse.jsonUnsafe(OpenApi.fromApi(EnglishApi)),
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
    Layer.mergeAll(
      ApiRoutes,
      ApiDocs,
      FrenchApiDocs,
      EnglishApiDocs,
      LocalizedOpenApiRoutes,
      BackOfficeStaticRoutes,
      PublicQuoteStaticRoutes,
      StaticRoutes,
    ),
    {
      middleware: (application) =>
        Effect.gen(function* () {
          return yield* traceRequest(
            identifyRequest(preventHtmlCaching(HttpMiddleware.logger(application))),
          );
        }),
      disableLogger: true,
    },
  ).pipe(
    Layer.provide(RequestLimiterLive),
    Layer.provide(HttpTracingLive),
    Layer.provide(
      Layer.effect(
        HttpServerRequest.MaxBodySize,
        Effect.map(RuntimeConfiguration, (runtime) =>
          FileSystem.Size(runtime.http.maximumRequestBodyBytes),
        ),
      ),
    ),
    Layer.provide(NodeHttpServer.layer(createServer, { port: options.port })),
  );
};

export const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int('PORT').pipe(Config.withDefault(3000));
    const publicUrl = yield* Config.schema(Schema.URL, 'PUBLIC_ORIGIN');
    const staticRoot = yield* Config.string('STATIC_ROOT');
    const trustedProxyText = yield* Config.string('TRUSTED_PROXY_ADDRESSES').pipe(
      Config.withDefault(''),
    );
    const trustedProxyAddresses = yield* Schema.decodeUnknownEffect(Schema.Array(IpAddress))(
      trustedProxyText
        .split(',')
        .map((address) => address.trim())
        .filter(Boolean),
    );
    return makeServerLayer({ port, publicOrigin: publicUrl.origin, staticRoot }).pipe(
      Layer.provide(Layer.succeed(TrustedProxyAddresses, new Set(trustedProxyAddresses))),
    );
  }),
);
