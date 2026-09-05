import { HttpApi, OpenApi } from 'effect/unstable/httpapi';

import { ApiTelemetry } from './api-authentication.js';
import { CatalogApi } from './catalog/api.js';

import { AffairsApi } from './affairs/api.js';
import { AuthenticationApi } from './authentication/api.js';
import { BootstrapApi } from './bootstrap/api.js';
import { ClientPortalApi } from './client-portal/api.js';
import { ClientsApi } from './clients/api.js';
import { ApiTokensApi } from './api-tokens/api.js';
import { InvoicesApi } from './invoices/api.js';
import { IssuerSettingsApi } from './issuer-settings/api.js';
import { OrdersApi } from './orders/api.js';
import { QuoteConditionPresetsApi } from './quote-condition-presets/api.js';
import { QuoteLinksApi } from './quote-links/api.js';
import { QuotesApi } from './quotes/api.js';
import { StatusApi } from './status/api.js';

export { RevisionVersionParameter } from './api-common.js';
export { AffairsApi } from './affairs/api.js';
export { ClientPortalApi } from './client-portal/api.js';
export { ClientsApi } from './clients/api.js';
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

export class Api extends HttpApi.make('froment-api')
  .add(StatusApi)
  .add(CatalogApi)
  .add(BootstrapApi)
  .add(AuthenticationApi)
  .add(ClientsApi)
  .add(OrdersApi)
  .add(QuoteConditionPresetsApi)
  .add(IssuerSettingsApi)
  .add(AffairsApi)
  .add(QuotesApi)
  .add(QuoteLinksApi)
  .add(InvoicesApi)
  .add(ClientPortalApi)
  .add(ApiTokensApi)
  .middleware(ApiTelemetry)
  .annotateMerge(OpenApi.annotations({ version: 'latest' })) {}
