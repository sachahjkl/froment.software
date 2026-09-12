import Sqlite from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import {
  convertToFunctionalCents,
  ExchangeRateScale,
  findCurrencyConversion,
} from './currency-conversion.js';

describe('currency conversion', () => {
  it('rounds foreign cents to functional cents without floating-point arithmetic', () => {
    expect(convertToFunctionalCents(15_002, 1_100_000_000)).toBe(13_638);
    expect(convertToFunctionalCents(3_000, 1_100_000_000)).toBe(2_727);
    expect(convertToFunctionalCents(100, 3_000_000_000)).toBe(33);
  });

  it('uses an implicit unit rate or the latest stored rate on the requested date', () => {
    const sqlite = new Sqlite(':memory:');
    try {
      sqlite.exec(`
        create table company_settings (id integer primary key, functional_currency text not null);
        create table exchange_rates (
          rate_date text not null,
          functional_currency text not null,
          foreign_currency text not null,
          foreign_units_per_functional_unit_nanos integer not null
        );
        insert into company_settings values (1, 'EUR');
        insert into exchange_rates values ('2026-09-10', 'EUR', 'USD', 1100000000);
        insert into exchange_rates values ('2026-09-11', 'EUR', 'USD', 1200000000);
      `);
      expect(findCurrencyConversion(sqlite, 'EUR', '2026-09-12')).toEqual({
        functionalCurrency: 'EUR',
        exchangeRateDate: '2026-09-12',
        foreignUnitsPerFunctionalUnitNanos: ExchangeRateScale,
      });
      expect(findCurrencyConversion(sqlite, 'USD', '2026-09-10')).toEqual({
        functionalCurrency: 'EUR',
        exchangeRateDate: '2026-09-10',
        foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      });
      expect(findCurrencyConversion(sqlite, 'USD', '2026-09-09')).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
