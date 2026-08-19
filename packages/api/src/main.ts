import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { DatabaseLive } from './database/database.js';
import { ServerLive } from './server.js';

Layer.launch(ServerLive.pipe(Layer.provide(DatabaseLive))).pipe(NodeRuntime.runMain);
