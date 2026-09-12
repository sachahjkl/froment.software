import Sqlite from 'better-sqlite3';
import { CurrencyCode, ExchangeRate, type CurrencyCodeValue } from '@froment/contracts';
import { Schema } from 'effect';

export const ExchangeRateScale = 1_000_000_000;

export interface CurrencyConversion {
  readonly functionalCurrency: CurrencyCodeValue;
  readonly exchangeRateDate: string;
  readonly foreignUnitsPerFunctionalUnitNanos: number;
}

const StoredRate = Schema.Struct({
  rateDate: ExchangeRate.fields.rateDate,
  foreignUnitsPerFunctionalUnitNanos: ExchangeRate.fields.foreignUnitsPerFunctionalUnitNanos,
});

export const findCurrencyConversion = (
  sqlite: Sqlite.Database,
  foreignCurrency: CurrencyCodeValue,
  conversionDate: string,
): CurrencyConversion | undefined => {
  const functionalCurrency = Schema.decodeUnknownSync(CurrencyCode)(
    sqlite.prepare('select functional_currency from company_settings where id = 1').pluck().get(),
  );
  if (functionalCurrency === foreignCurrency) {
    return {
      functionalCurrency,
      exchangeRateDate: conversionDate,
      foreignUnitsPerFunctionalUnitNanos: ExchangeRateScale,
    };
  }
  const rate = Schema.decodeUnknownSync(Schema.UndefinedOr(StoredRate))(
    sqlite
      .prepare(
        `select rate_date as rateDate,
                foreign_units_per_functional_unit_nanos as foreignUnitsPerFunctionalUnitNanos
         from exchange_rates where functional_currency = ? and foreign_currency = ?
         and rate_date <= ? order by rate_date desc limit 1`,
      )
      .get(functionalCurrency, foreignCurrency, conversionDate),
  );
  return rate === undefined
    ? undefined
    : {
        functionalCurrency,
        exchangeRateDate: rate.rateDate,
        foreignUnitsPerFunctionalUnitNanos: rate.foreignUnitsPerFunctionalUnitNanos,
      };
};

export const convertToFunctionalCents = (foreignCents: number, rateNanos: number): number => {
  const numerator = BigInt(foreignCents) * BigInt(ExchangeRateScale);
  const divisor = BigInt(rateNanos);
  const rounded = (numerator + divisor / 2n) / divisor;
  const result = Number(rounded);
  if (!Number.isSafeInteger(result)) throw new RangeError('invoice.functional_amount_too_large');
  return result;
};
