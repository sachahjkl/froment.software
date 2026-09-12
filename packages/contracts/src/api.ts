import { HttpApi, OpenApi } from 'effect/unstable/httpapi';

import { ApiTelemetry } from './api-authentication.js';
import { CatalogApi } from './catalog/api.js';
import { IntegrationsApi } from './integrations/api.js';
import { BankingApi } from './banking/api.js';
import { TeamApi } from './team/api.js';
import { RolesApi } from './roles/api.js';
import { CreditNotesApi } from './invoices/credit-notes-api.js';
import { BankLedgerApi } from './banking/ledger-api.js';

import { AffairsApi } from './affairs/api.js';
import { AuditApi } from './audit/api.js';
import { AuthenticationApi } from './authentication/api.js';
import { PasskeysApi } from './authentication/passkeys-api.js';
import { EmailDraftsApi } from './integrations/email-drafts-api.js';
import { EmailTemplatesApi } from './integrations/email-templates-api.js';
import { RemindersApi } from './integrations/reminders-api.js';
import { ProviderActionsApi } from './integrations/provider-actions-api.js';
import { BootstrapApi } from './bootstrap/api.js';
import { ClientPortalApi } from './client-portal/api.js';
import { ClientsApi } from './clients/api.js';
import { CompanyApi } from './company/api.js';
import { SuppliersApi } from './suppliers/api.js';
import { SupplierInvoicesApi } from './supplier-invoices/api.js';
import { ApiTokensApi } from './api-tokens/api.js';
import { InvoicesApi } from './invoices/api.js';
import { IssuerSettingsApi } from './issuer-settings/api.js';
import { OrdersApi } from './orders/api.js';
import { QuoteConditionPresetsApi } from './quote-condition-presets/api.js';
import { QuoteLinksApi } from './quote-links/api.js';
import { QuotesApi } from './quotes/api.js';
import { StatusApi } from './status/api.js';
import { BlogApi } from './blog/api.js';
import { AccountingApi } from './accounting/api.js';
import { DemoApi } from './demo/api.js';

export { RevisionVersionParameter } from './api-common.js';
export { AffairsApi } from './affairs/api.js';
export { ClientPortalApi } from './client-portal/api.js';
export { ClientsApi } from './clients/api.js';
export { CompanyApi } from './company/api.js';
export { RolesApi } from './roles/api.js';
export { SuppliersApi } from './suppliers/api.js';
export { SupplierInvoicesApi } from './supplier-invoices/api.js';
export { ApiTokensApi } from './api-tokens/api.js';
export { InvoicesApi } from './invoices/api.js';
export { IssuerSettingsApi } from './issuer-settings/api.js';
export { OrdersApi } from './orders/api.js';
export { QuoteConditionPresetsApi } from './quote-condition-presets/api.js';
export { QuoteLinksApi } from './quote-links/api.js';
export { QuotesApi } from './quotes/api.js';
export { AuthenticationApi } from './authentication/api.js';
export { BootstrapApi } from './bootstrap/api.js';
export { StatusApi } from './status/api.js';
export { BlogApi } from './blog/api.js';
export { AccountingApi } from './accounting/api.js';
export { DemoApi } from './demo/api.js';

export class Api extends HttpApi.make('froment-api')
  .add(StatusApi)
  .add(BlogApi)
  .add(CatalogApi)
  .add(IntegrationsApi)
  .add(BankingApi)
  .add(TeamApi)
  .add(RolesApi)
  .add(CreditNotesApi)
  .add(BankLedgerApi)
  .add(BootstrapApi)
  .add(AuthenticationApi)
  .add(PasskeysApi)
  .add(EmailDraftsApi)
  .add(EmailTemplatesApi)
  .add(RemindersApi)
  .add(ProviderActionsApi)
  .add(ClientsApi)
  .add(CompanyApi)
  .add(SuppliersApi)
  .add(SupplierInvoicesApi)
  .add(OrdersApi)
  .add(QuoteConditionPresetsApi)
  .add(IssuerSettingsApi)
  .add(AffairsApi)
  .add(AuditApi)
  .add(QuotesApi)
  .add(QuoteLinksApi)
  .add(InvoicesApi)
  .add(ClientPortalApi)
  .add(ApiTokensApi)
  .add(AccountingApi)
  .add(DemoApi)
  .middleware(ApiTelemetry)
  .annotateMerge(OpenApi.annotations({ version: 'latest' })) {}
