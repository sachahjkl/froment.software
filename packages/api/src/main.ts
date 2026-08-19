import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { BootstrapLive } from './bootstrap/bootstrap.js';
import { AuthenticationLive } from './authentication/authentication.js';
import { AuthenticationConfigLive } from './authentication/authentication-config.js';
import { ClientsLive } from './clients/clients.js';
import { DatabaseLive } from './database/database.js';
import { ServerLive } from './server.js';

const ServicesLive = Layer.mergeAll(BootstrapLive, AuthenticationLive, ClientsLive).pipe(
  Layer.provide(AuthenticationConfigLive),
  Layer.provideMerge(DatabaseLive),
);

Layer.launch(ServerLive.pipe(Layer.provide(ServicesLive))).pipe(NodeRuntime.runMain);
