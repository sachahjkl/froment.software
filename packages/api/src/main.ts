import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';

import { BootstrapLive } from './bootstrap/bootstrap.js';
import { AuditLive } from './audit/audit.js';
import { BusinessConfigLive } from './business/business-config.js';
import { AuthenticationLive } from './authentication/authentication.js';
import { AuthenticationConfigLive } from './authentication/authentication-config.js';
import { PasswordsLive } from './authentication/password.js';
import { AccessTokensLive } from './authentication/paseto.js';
import { ApiTokensLive } from './api-tokens/service.js';
import { ClientsLive } from './clients/clients.js';
import { DatabaseLive } from './database/database.js';
import { DeploymentLive } from './deployment/deployment.js';
import { IssuerSettingsLive } from './issuer-settings/service.js';
import { DocumentArtifactsLive } from './documents/document-artifacts.js';
import { DocumentRendererLive } from './documents/document-renderer.js';
import { InvoicePdfJobsLive, InvoicePdfWorkerLive } from './invoices/pdf-jobs.js';
import { QuotesLive } from './quotes/quotes.js';
import { QuoteLinksLive } from './quote-links/service.js';
import { QuoteConditionPresetsLive } from './quote-condition-presets/service.js';
import { CatalogLive } from './catalog/service.js';
import { InvoicesLive } from './invoices/invoices.js';
import { OrdersLive } from './orders/orders.js';
import { ServerLive } from './server.js';
import { ObservabilityLive } from './observability/observability.js';
import { ClientPortalLive } from './client-portal/client-portal.js';
import { RuntimeConfigurationLive } from './runtime-config.js';

const QuoteCoreLive = Layer.mergeAll(
  QuotesLive,
  DocumentRendererLive,
  InvoicesLive,
  OrdersLive,
).pipe(Layer.provideMerge(IssuerSettingsLive), Layer.provideMerge(BusinessConfigLive));
const QuoteServicesLive = DocumentArtifactsLive.pipe(Layer.provideMerge(QuoteCoreLive));
const InvoicePdfServicesLive = InvoicePdfJobsLive.pipe(Layer.provideMerge(QuoteServicesLive));
const InvoicePdfRuntimeLive = Layer.merge(
  InvoicePdfServicesLive,
  InvoicePdfWorkerLive.pipe(Layer.provide(InvoicePdfServicesLive)),
);
const AuthenticationServicesLive = BootstrapLive.pipe(
  Layer.provideMerge(AuthenticationLive.pipe(Layer.provideMerge(AccessTokensLive))),
);

const ServicesLive = Layer.mergeAll(
  AuthenticationServicesLive,
  ApiTokensLive,
  ClientsLive,
  InvoicePdfRuntimeLive,
  QuoteLinksLive.pipe(Layer.provide(BusinessConfigLive)),
  QuoteConditionPresetsLive,
  CatalogLive,
  DeploymentLive,
  ClientPortalLive,
).pipe(
  Layer.provideMerge(AuditLive),
  Layer.provideMerge(PasswordsLive),
  Layer.provideMerge(AuthenticationConfigLive),
  Layer.provideMerge(RuntimeConfigurationLive),
  Layer.provideMerge(DatabaseLive),
);

Layer.launch(ServerLive.pipe(Layer.provide(ServicesLive), Layer.provide(ObservabilityLive))).pipe(
  NodeRuntime.runMain,
);
