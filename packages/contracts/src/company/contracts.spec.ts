import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { CompanySettingsUpdateRequest, ExchangeRateManualRequest } from './contracts.js';

const request = {
  jurisdiction: 'FR',
  functionalCurrency: 'EUR',
  fiscalYearStartMonth: 4,
  fiscalYearStartDay: 1,
  enabledModules: ['sales', 'purchasing', 'accounting'],
  retentionYears: 10,
  expectedVersion: 1,
};

describe('company settings contracts', () => {
  it('accepts a France configuration with a non-calendar fiscal year', () => {
    expect(Schema.is(CompanySettingsUpdateRequest)(request)).toBe(true);
  });

  it('rejects invalid start dates, duplicate modules, and short retention', () => {
    expect(
      Schema.is(CompanySettingsUpdateRequest)({
        ...request,
        fiscalYearStartMonth: 2,
        fiscalYearStartDay: 30,
      }),
    ).toBe(false);
    expect(
      Schema.is(CompanySettingsUpdateRequest)({
        ...request,
        enabledModules: ['sales', 'sales'],
      }),
    ).toBe(false);
    expect(Schema.is(CompanySettingsUpdateRequest)({ ...request, retentionYears: 9 })).toBe(false);
  });

  it('requires a dated ISO currency rate with nine-decimal integer precision', () => {
    const rate = {
      rateDate: '2026-09-11',
      foreignCurrency: 'USD',
      foreignUnitsPerFunctionalUnitNanos: 1_159_200_000,
    };
    expect(Schema.is(ExchangeRateManualRequest)(rate)).toBe(true);
    expect(
      Schema.is(ExchangeRateManualRequest)({
        ...rate,
        foreignUnitsPerFunctionalUnitNanos: 0,
      }),
    ).toBe(false);
    expect(Schema.is(ExchangeRateManualRequest)({ ...rate, foreignCurrency: 'usd' })).toBe(false);
  });
});
