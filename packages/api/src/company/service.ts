import {
  AccountingAlreadyInitialized,
  CompanyModule,
  CompanySettings,
  CompanySettingsConflict,
  FunctionalCurrencyLocked,
  type AccountingInitializeRequestValue,
  type CompanySettingsUpdateRequestValue,
  type CompanySettingsValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const CompanySettingsRecord = Schema.Struct({
  jurisdiction: Schema.Literal('FR'),
  functionalCurrency: Schema.String,
  accountingInitialized: Schema.Number,
  fiscalYearStartMonth: Schema.Int,
  fiscalYearStartDay: Schema.Int,
  defaultFiscalYearMonths: Schema.Literal(12),
  enabledModules: Schema.fromJsonString(Schema.Array(CompanyModule)),
  retentionYears: Schema.Int,
  version: Schema.Int,
  updatedAt: Schema.Int,
});

const selectSettings = `select jurisdiction, functional_currency as functionalCurrency,
  accounting_initialized as accountingInitialized,
  fiscal_year_start_month as fiscalYearStartMonth,
  fiscal_year_start_day as fiscalYearStartDay,
  default_fiscal_year_months as defaultFiscalYearMonths,
  enabled_modules as enabledModules, retention_years as retentionYears,
  version, updated_at as updatedAt from company_settings where id = 1`;

const toSettings = (record: typeof CompanySettingsRecord.Type): CompanySettingsValue =>
  Schema.decodeUnknownSync(CompanySettings)({
    ...record,
    accountingInitialized: record.accountingInitialized === 1,
  });

export interface CompanyService {
  readonly get: Effect.Effect<CompanySettingsValue, DatabaseError>;
  readonly update: (
    request: CompanySettingsUpdateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    CompanySettingsValue,
    CompanySettingsConflict | FunctionalCurrencyLocked | DatabaseError
  >;
  readonly initializeAccounting: (
    request: AccountingInitializeRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<
    CompanySettingsValue,
    CompanySettingsConflict | AccountingAlreadyInitialized | DatabaseError
  >;
}

export class Company extends Context.Service<Company, CompanyService>()('@froment/api/Company') {}

export const CompanyLive = Layer.effect(
  Company,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const audit = yield* Audit;
    const read = () =>
      toSettings(
        Schema.decodeUnknownSync(CompanySettingsRecord)(sqlite.prepare(selectSettings).get()),
      );

    const get = Effect.try({
      try: read,
      catch: (cause) => new DatabaseError({ operation: 'get.company-settings', cause }),
    });

    const update = Effect.fn('Company.update')(function* (
      request: CompanySettingsUpdateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const current = read();
              if (current.version !== request.expectedVersion) {
                throw new CompanySettingsConflict({ code: 'company.settings_conflict' });
              }
              if (
                current.accountingInitialized &&
                current.functionalCurrency !== request.functionalCurrency
              ) {
                throw new FunctionalCurrencyLocked({
                  code: 'company.functional_currency_locked',
                });
              }
              if (current.functionalCurrency !== request.functionalCurrency) {
                sqlite.prepare('delete from exchange_rates').run();
              }
              const version = current.version + 1;
              const updatedAt = Math.max(now, current.updatedAt + 1);
              const changed = sqlite
                .prepare(
                  `update company_settings set jurisdiction = ?, functional_currency = ?,
                   fiscal_year_start_month = ?, fiscal_year_start_day = ?, enabled_modules = ?,
                   retention_years = ?, version = ?, updated_at = ? where id = 1 and version = ?`,
                )
                .run(
                  request.jurisdiction,
                  request.functionalCurrency,
                  request.fiscalYearStartMonth,
                  request.fiscalYearStartDay,
                  JSON.stringify(request.enabledModules),
                  request.retentionYears,
                  version,
                  updatedAt,
                  request.expectedVersion,
                ).changes;
              if (changed !== 1) {
                throw new CompanySettingsConflict({ code: 'company.settings_conflict' });
              }
              audit.insert({
                action: 'company.settings-updated',
                actorUserId,
                resourceType: 'company',
                resourceId: 'settings',
                occurredAt: updatedAt,
              });
              return read();
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof CompanySettingsConflict || cause instanceof FunctionalCurrencyLocked)
            return cause;
          return new DatabaseError({ operation: 'update.company-settings', cause });
        },
      });
    });

    const initializeAccounting = Effect.fn('Company.initializeAccounting')(function* (
      request: AccountingInitializeRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const current = read();
              if (current.version !== request.expectedVersion) {
                throw new CompanySettingsConflict({ code: 'company.settings_conflict' });
              }
              if (current.accountingInitialized) {
                throw new AccountingAlreadyInitialized({
                  code: 'company.accounting_already_initialized',
                });
              }
              const version = current.version + 1;
              const updatedAt = Math.max(now, current.updatedAt + 1);
              const changed = sqlite
                .prepare(
                  `update company_settings set functional_currency = ?, accounting_initialized = 1,
                   version = ?, updated_at = ? where id = 1 and version = ?`,
                )
                .run(
                  request.functionalCurrency,
                  version,
                  updatedAt,
                  request.expectedVersion,
                ).changes;
              if (changed !== 1) {
                throw new CompanySettingsConflict({ code: 'company.settings_conflict' });
              }
              audit.insert({
                action: 'company.accounting-initialized',
                actorUserId,
                resourceType: 'company',
                resourceId: 'accounting',
                occurredAt: updatedAt,
              });
              return read();
            })
            .immediate(),
        catch: (cause) => {
          if (
            cause instanceof CompanySettingsConflict ||
            cause instanceof AccountingAlreadyInitialized
          ) {
            return cause;
          }
          return new DatabaseError({ operation: 'initialize.accounting', cause });
        },
      });
    });

    return { get, update, initializeAccounting };
  }),
);
