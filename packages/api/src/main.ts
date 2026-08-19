import { NodeRuntime } from '@effect/platform-node';
import { Config, Effect, Layer } from 'effect';

import { makeServerLayer } from './server.js';

const ServerLive = Layer.unwrap(
  Effect.gen(function* () {
    const port = yield* Config.int('PORT').pipe(Config.withDefault(3000));
    const staticRoot = yield* Config.string('STATIC_ROOT');
    return makeServerLayer({ port, staticRoot });
  }),
);

Layer.launch(ServerLive).pipe(NodeRuntime.runMain);
