import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Permissions } from '../permissions.js';
import {
  AccountingAlreadyInitialized,
  AccountingInitializeRequest,
  CompanySettings,
  CompanySettingsConflict,
  CompanySettingsUpdateRequest,
  FunctionalCurrencyLocked,
  ExchangeRate,
  ExchangeRateConflict,
  ExchangeRateImportFailed,
  ExchangeRateList,
  ExchangeRateManualRequest,
} from './contracts.js';

const readErrors = [
  AuthenticationRequired.pipe(HttpApiSchema.status(401)),
  PermissionDenied.pipe(HttpApiSchema.status(403)),
] as const;

const writeErrors = [...readErrors, RequestRateLimited.pipe(HttpApiSchema.status(429))] as const;

export class CompanyApi extends HttpApiGroup.make('company', { topLevel: true }).add(
  HttpApiEndpoint.get('companySettingsGet', '/api/company', {
    success: CompanySettings,
    error: readErrors,
  }).pipe(requirePermissions([Permissions.companyRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('companySettingsUpdate', '/api/company', {
    payload: CompanySettingsUpdateRequest,
    success: CompanySettings,
    error: [
      ...writeErrors,
      CompanySettingsConflict.pipe(HttpApiSchema.status(409)),
      FunctionalCurrencyLocked.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.companyUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('companyAccountingInitialize', '/api/company/accounting/initialize', {
    payload: AccountingInitializeRequest,
    success: CompanySettings,
    error: [
      ...writeErrors,
      CompanySettingsConflict.pipe(HttpApiSchema.status(409)),
      AccountingAlreadyInitialized.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.companyUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('companyExchangeRateList', '/api/company/exchange-rates', {
    success: ExchangeRateList,
    error: readErrors,
  }).pipe(requirePermissions([Permissions.companyRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('companyExchangeRateSet', '/api/company/exchange-rates', {
    payload: ExchangeRateManualRequest,
    success: ExchangeRate,
    error: [...writeErrors, ExchangeRateConflict.pipe(HttpApiSchema.status(409))],
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.companyUpdate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('companyExchangeRateImport', '/api/company/exchange-rates/ecb', {
    success: ExchangeRateList,
    error: [...writeErrors, ExchangeRateImportFailed.pipe(HttpApiSchema.status(502))],
  }).pipe(requirePermissions([Permissions.companyUpdate]), authenticate, frontendSpecific),
) {}
