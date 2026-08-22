import { NodeHttpServer } from '@effect/platform-node';
import { apiForLanguage } from '@froment/contracts';
import { Config, Effect, Layer, Schema } from 'effect';
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
import { ClientPortalHandlers } from './client-portal/handlers.js';
import { ClientHandlers } from './clients/handlers.js';
import { HttpTracingLive, traceRequest } from './observability/http-tracing.js';
import { identifyRequest } from './http/response.js';
import { ApiBrowserRequestLive } from './http/origin.js';
import { ApiRequestBodyLive, RequestBodyLimits } from './http/request-body.js';
import { IntegrationTokenHandlers } from './integration-tokens/handlers.js';
import { InvoiceHandlers } from './invoices/handlers.js';
import { OrderHandlers } from './orders/handlers.js';
import { QuoteHandlers } from './quotes/handlers.js';
import { RequestLimiterLive } from './server/request-limiter.js';
import { SystemHandlers } from './system/handlers.js';

const FrenchApi = apiForLanguage('fr');
const EnglishApi = apiForLanguage('en');

const ApiRoutes = HttpApiBuilder.layer(FrenchApi, { openapiPath: '/api/openapi.json' }).pipe(
  Layer.provide(
    Layer.mergeAll(
      SystemHandlers,
      ClientHandlers,
      OrderHandlers,
      QuoteHandlers,
      InvoiceHandlers,
      ClientPortalHandlers,
      IntegrationTokenHandlers,
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
          return yield* traceRequest(identifyRequest(HttpMiddleware.logger(application)));
        }),
      disableLogger: true,
    },
  ).pipe(
    Layer.provide(RequestLimiterLive),
    Layer.provide(HttpTracingLive),
    Layer.provide(Layer.succeed(HttpServerRequest.MaxBodySize, RequestBodyLimits.thirtyTwoKiB)),
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
