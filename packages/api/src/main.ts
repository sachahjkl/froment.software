import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { BootstrapLive } from './bootstrap/bootstrap.js';
import { AuditLive } from './audit/audit.js';
import { AuthenticationLive } from './authentication/authentication.js';
import { AuthenticationConfigLive } from './authentication/authentication-config.js';
import { ClientsLive } from './clients/clients.js';
import { DatabaseLive } from './database/database.js';
import { DeploymentLive } from './deployment/deployment.js';
import { IssuerSettingsLive } from './documents/issuer-settings.js';
import { DocumentArtifactsLive } from './documents/document-artifacts.js';
import { QuoteRendererLive } from './documents/quote-renderer.js';
import { QuotesLive } from './quotes/quotes.js';
import { ServerLive } from './server.js';
import { ObservabilityLive } from './observability/observability.js';

const QuoteCoreLive = Layer.mergeAll(QuotesLive, QuoteRendererLive).pipe(
  Layer.provideMerge(IssuerSettingsLive),
);
const QuoteServicesLive = DocumentArtifactsLive.pipe(Layer.provideMerge(QuoteCoreLive));

const ServicesLive = Layer.mergeAll(
  BootstrapLive,
  AuthenticationLive,
  ClientsLive,
  QuoteServicesLive,
  DeploymentLive,
).pipe(
  Layer.provide(AuditLive),
  Layer.provide(AuthenticationConfigLive),
  Layer.provideMerge(DatabaseLive),
);

Layer.launch(ServerLive.pipe(Layer.provide(ServicesLive), Layer.provide(ObservabilityLive))).pipe(
  NodeRuntime.runMain,
);
