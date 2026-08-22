import type { Language } from '@froment/l10n';
import { HttpApi, OpenApi } from 'effect/unstable/httpapi';

import { localizeOpenApi } from './api-documentation.js';
import { ClientPortalApi } from './client-portal/api.js';
import { ClientsApi } from './clients/api.js';
import { IntegrationTokensApi } from './integration-tokens/api.js';
import { InvoicesApi } from './invoices/api.js';
import { OrdersApi } from './orders/api.js';
import { QuotesApi } from './quotes/api.js';
import { SystemApi } from './system/api.js';

export { RevisionVersionParameter } from './api-common.js';
export { ClientPortalApi } from './client-portal/api.js';
export { ClientsApi } from './clients/api.js';
export { IntegrationTokensApi } from './integration-tokens/api.js';
export { InvoicesApi } from './invoices/api.js';
export { OrdersApi } from './orders/api.js';
export { QuotesApi } from './quotes/api.js';
export { SystemApi } from './system/api.js';

export class Api extends HttpApi.make('froment-api')
  .add(SystemApi)
  .add(ClientsApi)
  .add(OrdersApi)
  .add(QuotesApi)
  .add(InvoicesApi)
  .add(ClientPortalApi)
  .add(IntegrationTokensApi)
  .annotateMerge(OpenApi.annotations({ version: 'latest' })) {}

export const apiForLanguage = (language: Language) =>
  Api.annotateMerge(
    OpenApi.annotations({ transform: (specification) => localizeOpenApi(specification, language) }),
  );
