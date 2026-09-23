import { NodeHttpServer } from '@effect/platform-node';
import type { PublicRuntimeConfigValue } from '@froment/contracts';
import { Config, Effect, Layer, Schema } from 'effect';
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpStaticServer,
} from 'effect/unstable/http';
import { createServer } from 'node:http';
import { Deployment, DeploymentLive } from './deployment/deployment.js';
import { RuntimeConfiguration, RuntimeConfigurationLive } from './runtime-config.js';

export const makeMarketingServerLayer = (options: {
  readonly port: number;
  readonly publicOrigin: string;
  readonly backofficeOrigin: string;
  readonly staticRoot: string;
  readonly runtimeConfig: PublicRuntimeConfigValue;
}) =>
  HttpRouter.serve(HttpStaticServer.layer({ root: options.staticRoot, index: 'index.html' }), {
    middleware: (application) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.method !== 'GET') return yield* application;
        const url = new URL(request.url, options.publicOrigin);
        if (url.pathname === '/api/health') return HttpServerResponse.jsonUnsafe({ status: 'ok' });
        if (url.pathname === '/runtime-config.js')
          return HttpServerResponse.text(
            `globalThis.fromentRuntimeConfig=${JSON.stringify(options.runtimeConfig)};document.documentElement.dataset.appEnvironment=globalThis.fromentRuntimeConfig.appEnvironment;document.documentElement.dataset.sitePhase=globalThis.fromentRuntimeConfig.sitePhase;`,
            {
              contentType: 'text/javascript; charset=utf-8',
              headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
            },
          );
        if (url.pathname === '/') return HttpServerResponse.redirect('/fr');
        if (url.pathname === '/backoffice' || url.pathname.startsWith('/backoffice/')) {
          const destination = new URL(options.backofficeOrigin);
          destination.pathname = url.pathname.slice('/backoffice'.length) || '/';
          destination.search = url.search;
          return HttpServerResponse.redirect(destination);
        }
        if (url.pathname === '/quote' || url.pathname.startsWith('/quote/')) {
          return HttpServerResponse.redirect(
            new URL(url.pathname + url.search, options.backofficeOrigin),
          );
        }
        return yield* application;
      }),
    disableLogger: true,
  }).pipe(Layer.provide(NodeHttpServer.layer(createServer, { port: options.port })));

export const MarketingServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int('PORT').pipe(Config.withDefault(3000));
    const publicUrl = yield* Config.schema(Schema.URL, 'PUBLIC_ORIGIN');
    const staticRoot = yield* Config.string('STATIC_ROOT');
    const runtime = yield* RuntimeConfiguration;
    const deployment = yield* Deployment;
    return makeMarketingServerLayer({
      port,
      publicOrigin: publicUrl.origin,
      backofficeOrigin: runtime.marketing.backofficeOrigin,
      staticRoot,
      runtimeConfig: { ...runtime.application, commit: deployment.metadata.commit },
    });
  }),
);

export const MarketingDependenciesLive = Layer.merge(RuntimeConfigurationLive, DeploymentLive);
