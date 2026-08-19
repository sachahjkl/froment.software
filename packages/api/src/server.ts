import { NodeHttpServer } from '@effect/platform-node';
import { Api } from '@froment/contracts';
import { Config, Effect, Layer } from 'effect';
import { HttpRouter, HttpStaticServer } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { createServer } from 'node:http';

import { Database } from './database/database.js';

const ApiHandlers = HttpApiBuilder.group(Api, 'system', (handlers) =>
  Effect.succeed(
    handlers.handle(
      'health',
      Effect.fn('health')(function* () {
        const database = yield* Database;
        yield* Effect.sync(() => database.sqlite.prepare('select 1').get());
        return { status: 'ok' as const };
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
