import { NodeHttpServer } from '@effect/platform-node';
import { Api } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpRouter, HttpStaticServer } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';

const ApiHandlers = HttpApiBuilder.group(Api, 'system', (handlers) =>
  Effect.succeed(handlers.handle('health', () => Effect.succeed({ status: 'ok' as const }))),
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
    Layer.provide(NodeHttpServer.layer(createServer, { port: options.port })),
  );
};
