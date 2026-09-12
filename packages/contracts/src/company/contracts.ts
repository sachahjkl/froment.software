import { Schema } from 'effect';
import { CalendarDate } from '../temporal.js';
import { PositiveSafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';

export const Jurisdiction = Schema.Literal('FR');
export type Jurisdiction = typeof Jurisdiction.Type;

export const CompanyModule = Schema.Literals([
  'sales',
  'purchasing',
  'banking',
  'accounting',
  'tax',
  'demonstration',
]);
export type CompanyModule = typeof CompanyModule.Type;

export const CurrencyCode = Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/));
export type CurrencyCode = typeof CurrencyCode.Type;
export const FunctionalCurrency = CurrencyCode;
export type FunctionalCurrency = typeof FunctionalCurrency.Type;

export const ExchangeRateSource = Schema.Literals(['ecb', 'manual']);
export type ExchangeRateSource = typeof ExchangeRateSource.Type;
export const ExchangeRate = Schema.Struct({
  id: Ulid,
  rateDate: CalendarDate,
  functionalCurrency: CurrencyCode,
  foreignCurrency: CurrencyCode,
  foreignUnitsPerFunctionalUnitNanos: PositiveSafeInteger,
  source: ExchangeRateSource,
  importedAt: Schema.Int,
  createdByUserId: Schema.NullOr(Ulid),
}).annotate({ identifier: 'ExchangeRate' });
export type ExchangeRate = typeof ExchangeRate.Type;
export const ExchangeRateList = Schema.Array(ExchangeRate).check(Schema.isMaxLength(10_000));
export const ExchangeRateManualRequest = Schema.Struct({
  rateDate: CalendarDate,
  foreignCurrency: CurrencyCode,
  foreignUnitsPerFunctionalUnitNanos: PositiveSafeInteger,
}).annotate({ identifier: 'ExchangeRateManualRequest' });
export type ExchangeRateManualRequest = typeof ExchangeRateManualRequest.Type;

const FiscalYearStart = Schema.Struct({
  fiscalYearStartMonth: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 })),
  fiscalYearStartDay: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 31 })),
});

const validFiscalYearStart = Schema.makeFilter<{
  readonly fiscalYearStartMonth: number;
  readonly fiscalYearStartDay: number;
}>(
  ({ fiscalYearStartMonth, fiscalYearStartDay }) =>
    new Date(Date.UTC(2024, fiscalYearStartMonth - 1, fiscalYearStartDay)).getUTCMonth() ===
    fiscalYearStartMonth - 1,
  { message: 'company.fiscal_year_start_invalid' },
);

export const CompanySettings = Schema.Struct({
  jurisdiction: Jurisdiction,
  functionalCurrency: FunctionalCurrency,
  accountingInitialized: Schema.Boolean,
  ...FiscalYearStart.fields,
  defaultFiscalYearMonths: Schema.Literal(12),
  enabledModules: Schema.Array(CompanyModule).check(Schema.isUnique()),
  retentionYears: Schema.Int.check(Schema.isGreaterThanOrEqualTo(10)),
  version: Schema.Int.check(Schema.isGreaterThan(0)),
  updatedAt: Schema.Int,
})
  .check(validFiscalYearStart)
  .annotate({ identifier: 'CompanySettings' });
export type CompanySettings = typeof CompanySettings.Type;

export const CompanySettingsUpdateRequest = Schema.Struct({
  jurisdiction: Jurisdiction,
  functionalCurrency: FunctionalCurrency,
  ...FiscalYearStart.fields,
  enabledModules: Schema.Array(CompanyModule).check(Schema.isUnique()),
  retentionYears: Schema.Int.check(Schema.isGreaterThanOrEqualTo(10)),
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
})
  .check(validFiscalYearStart)
  .annotate({ identifier: 'CompanySettingsUpdateRequest' });
export type CompanySettingsUpdateRequest = typeof CompanySettingsUpdateRequest.Type;

export const AccountingInitializeRequest = Schema.Struct({
  functionalCurrency: FunctionalCurrency,
  expectedVersion: Schema.Int.check(Schema.isGreaterThan(0)),
}).annotate({ identifier: 'AccountingInitializeRequest' });
export type AccountingInitializeRequest = typeof AccountingInitializeRequest.Type;

export class CompanySettingsConflict extends Schema.TaggedError<CompanySettingsConflict>()(
  'CompanySettingsConflict',
  { code: Schema.Literal('company.settings_conflict') },
) {}

export class FunctionalCurrencyLocked extends Schema.TaggedError<FunctionalCurrencyLocked>()(
  'FunctionalCurrencyLocked',
  { code: Schema.Literal('company.functional_currency_locked') },
) {}

export class AccountingAlreadyInitialized extends Schema.TaggedError<AccountingAlreadyInitialized>()(
  'AccountingAlreadyInitialized',
  { code: Schema.Literal('company.accounting_already_initialized') },
) {}

export class ExchangeRateConflict extends Schema.TaggedError<ExchangeRateConflict>()(
  'ExchangeRateConflict',
  { code: Schema.Literal('company.exchange_rate_conflict') },
) {}

export class ExchangeRateImportFailed extends Schema.TaggedError<ExchangeRateImportFailed>()(
  'ExchangeRateImportFailed',
  { code: Schema.Literal('company.exchange_rate_import_failed') },
) {}

export const CompanyFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  CompanySettingsConflict,
  FunctionalCurrencyLocked,
  AccountingAlreadyInitialized,
  ExchangeRateConflict,
  ExchangeRateImportFailed,
]);
export type CompanyFailure = typeof CompanyFailure.Type;
