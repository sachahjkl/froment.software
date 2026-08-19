import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { BootstrapLive } from './bootstrap/bootstrap.js';
import { AuthenticationLive } from './authentication/authentication.js';
import { AuthenticationConfigLive } from './authentication/authentication-config.js';
import { ClientsLive } from './clients/clients.js';
import { DatabaseLive } from './database/database.js';
import { DeploymentLive } from './deployment/deployment.js';
import { IssuerSettingsLive } from './documents/issuer-settings.js';
import { QuoteRendererLive } from './documents/quote-renderer.js';
import { QuotesLive } from './quotes/quotes.js';
import { ServerLive } from './server.js';

const QuoteServicesLive = Layer.mergeAll(QuotesLive, QuoteRendererLive).pipe(
  Layer.provideMerge(IssuerSettingsLive),
);

const ServicesLive = Layer.mergeAll(
  BootstrapLive,
  AuthenticationLive,
  ClientsLive,
  QuoteServicesLive,
  DeploymentLive,
).pipe(Layer.provide(AuthenticationConfigLive), Layer.provideMerge(DatabaseLive));

Layer.launch(ServerLive.pipe(Layer.provide(ServicesLive))).pipe(NodeRuntime.runMain);
