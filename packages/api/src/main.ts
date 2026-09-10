import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';
import { FetchHttpClient } from 'effect/unstable/http';
import { ConnectionConfigLive } from './integrations/connection-config.js';
import { ResendEmailTransportLive } from './integrations/resend.js';
import { EmailTestsLive, EmailTestWorkerLive } from './integrations/email-test-service.js';
import { CheckoutsLive, CheckoutWorkerLive } from './integrations/checkout-service.js';
import { StripeCheckoutTransportLive } from './integrations/stripe.js';

import { BootstrapLive } from './bootstrap/bootstrap.js';
import { AuditLive } from './audit/audit.js';
import { AuditReaderLive } from './audit/reader.js';
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
import { IntegrationsLive } from './integrations/service.js';
import { RemindersLive, ReminderWorkerLive } from './integrations/reminders.js';
import { IntegrationRetriesLive, IntegrationRetryWorkerLive } from './integrations/retries.js';
import { BankingLive } from './banking/service.js';
import { SimulatedProviders } from './integrations/providers.js';
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
  CheckoutWorkerLive.pipe(
    Layer.provideMerge(
      CheckoutsLive.pipe(
        Layer.provide(StripeCheckoutTransportLive.pipe(Layer.provide(FetchHttpClient.layer))),
      ),
    ),
  ),
  EmailTestWorkerLive.pipe(
    Layer.provideMerge(
      EmailTestsLive.pipe(
        Layer.provide(ResendEmailTransportLive.pipe(Layer.provide(FetchHttpClient.layer))),
      ),
    ),
  ),
  ReminderWorkerLive.pipe(
    Layer.provideMerge(RemindersLive.pipe(Layer.provide(SimulatedProviders))),
  ),
  IntegrationRetryWorkerLive.pipe(
    Layer.provideMerge(IntegrationRetriesLive),
    Layer.provideMerge(IntegrationsLive.pipe(Layer.provide(SimulatedProviders))),
  ),
  AuthenticationServicesLive,
  ApiTokensLive,
  AuditReaderLive,
  ClientsLive,
  InvoicePdfRuntimeLive,
  QuoteLinksLive.pipe(Layer.provide(BusinessConfigLive)),
  QuoteConditionPresetsLive,
  CatalogLive,
  SimulatedProviders,
  BankingLive,
  DeploymentLive,
  ClientPortalLive,
).pipe(
  Layer.provideMerge(ConnectionConfigLive),
  Layer.provideMerge(AuditLive),
  Layer.provideMerge(PasswordsLive),
  Layer.provideMerge(AuthenticationConfigLive),
  Layer.provideMerge(RuntimeConfigurationLive),
  Layer.provideMerge(DatabaseLive),
);

Layer.launch(ServerLive.pipe(Layer.provide(ServicesLive), Layer.provide(ObservabilityLive))).pipe(
  NodeRuntime.runMain,
);
