import {
  CurrencyCode,
  ExchangeRate,
  ExchangeRateConflict,
  ExchangeRateImportFailed,
  ExchangeRateList,
  type CurrencyCodeValue,
  type ExchangeRateManualRequestValue,
  type ExchangeRateValue,
  type UlidValue,
} from '@froment/contracts';
import { XMLParser } from 'fast-xml-parser';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { HttpClient } from 'effect/unstable/http';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { RuntimeConfiguration } from '../runtime-config.js';

const EcbExchangeRatesUrl = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml';
const ExchangeRateScale = 1_000_000_000;

const EcbCurrencyRate = Schema.Struct({
  '@_currency': CurrencyCode,
  '@_rate': Schema.NumberFromString.check(Schema.isGreaterThan(0)),
});
const EcbDailyRates = Schema.Struct({
  '@_time': Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  Cube: Schema.ArrayEnsure(EcbCurrencyRate),
});
const EcbDocument = Schema.Struct({
  'gesmes:Envelope': Schema.Struct({
    Cube: Schema.Struct({ Cube: Schema.ArrayEnsure(EcbDailyRates) }),
  }),
});

const ImportedExchangeRate = Schema.Struct({
  rateDate: ExchangeRate.fields.rateDate,
  foreignCurrency: ExchangeRate.fields.foreignCurrency,
  foreignUnitsPerFunctionalUnitNanos: ExchangeRate.fields.foreignUnitsPerFunctionalUnitNanos,
});
interface ImportedExchangeRate extends Schema.Schema.Type<typeof ImportedExchangeRate> {}

export const parseEcbExchangeRates = (
  xml: string,
  functionalCurrency: CurrencyCodeValue,
): ReadonlyArray<ImportedExchangeRate> => {
  const parsed = Schema.decodeUnknownSync(EcbDocument)(
    new XMLParser({ ignoreAttributes: false }).parse(xml),
  );
  return Schema.decodeUnknownSync(Schema.Array(ImportedExchangeRate))(
    parsed['gesmes:Envelope'].Cube.Cube.flatMap((daily) => {
      const euroRates = new Map<CurrencyCodeValue, number>([
        ['EUR', 1],
        ...daily.Cube.map((rate) => [rate['@_currency'], rate['@_rate']] as const),
      ]);
      const functionalPerEuro = euroRates.get(functionalCurrency);
      if (functionalPerEuro === undefined) {
        throw new Error('company.exchange_rate_functional_currency_missing');
      }
      return [...euroRates.entries()]
        .filter(([foreignCurrency]) => foreignCurrency !== functionalCurrency)
        .map(([foreignCurrency, foreignPerEuro]) => ({
          rateDate: daily['@_time'],
          foreignCurrency,
          foreignUnitsPerFunctionalUnitNanos: Math.round(
            (foreignPerEuro / functionalPerEuro) * ExchangeRateScale,
          ),
        }));
    }),
  );
};

const ExchangeRateRecord = Schema.Struct({
  id: ExchangeRate.fields.id,
  rateDate: ExchangeRate.fields.rateDate,
  functionalCurrency: ExchangeRate.fields.functionalCurrency,
  foreignCurrency: ExchangeRate.fields.foreignCurrency,
  foreignUnitsPerFunctionalUnitNanos: ExchangeRate.fields.foreignUnitsPerFunctionalUnitNanos,
  source: ExchangeRate.fields.source,
  importedAt: Schema.Int,
  createdByUserId: ExchangeRate.fields.createdByUserId,
});
const PreviousExchangeRateRecord = Schema.Struct({
  rate: ExchangeRate.fields.foreignUnitsPerFunctionalUnitNanos,
  source: ExchangeRate.fields.source,
});

const selectRates = `select id, rate_date as rateDate, functional_currency as functionalCurrency,
  foreign_currency as foreignCurrency,
  foreign_units_per_functional_unit_nanos as foreignUnitsPerFunctionalUnitNanos,
  source, imported_at as importedAt, created_by_user_id as createdByUserId
  from exchange_rates order by rate_date desc, foreign_currency`;
const selectRate = `select id, rate_date as rateDate, functional_currency as functionalCurrency,
  foreign_currency as foreignCurrency,
  foreign_units_per_functional_unit_nanos as foreignUnitsPerFunctionalUnitNanos,
  source, imported_at as importedAt, created_by_user_id as createdByUserId
  from exchange_rates where rate_date = ? and functional_currency = ? and foreign_currency = ?`;

export interface ExchangeRatesService {
  readonly list: Effect.Effect<ReadonlyArray<ExchangeRateValue>, DatabaseError>;
  readonly setManual: (
    request: ExchangeRateManualRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<ExchangeRateValue, ExchangeRateConflict | DatabaseError>;
  readonly importEcb: (
    actorUserId: UlidValue,
  ) => Effect.Effect<ReadonlyArray<ExchangeRateValue>, ExchangeRateImportFailed | DatabaseError>;
}

export class ExchangeRates extends Context.Service<ExchangeRates, ExchangeRatesService>()(
  '@froment/api/ExchangeRates',
) {}

export const ExchangeRatesLive = Layer.effect(
  ExchangeRates,
  Effect.gen(function* () {
    const { sqlite } = yield* Database;
    const audit = yield* Audit;
    const runtime = yield* RuntimeConfiguration;
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
    const readFunctionalCurrency = () =>
      Schema.decodeUnknownSync(CurrencyCode)(
        sqlite
          .prepare('select functional_currency from company_settings where id = 1')
          .pluck()
          .get(),
      );
    const readRates = () =>
      Schema.decodeUnknownSync(ExchangeRateList)(
        Schema.decodeUnknownSync(Schema.Array(ExchangeRateRecord))(
          sqlite.prepare(selectRates).all(),
        ),
      );
    const list = Effect.try({
      try: readRates,
      catch: (cause) => new DatabaseError({ operation: 'list.exchange-rates', cause }),
    });

    const setManual = Effect.fn('ExchangeRates.setManual')(function* (
      request: ExchangeRateManualRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const functionalCurrency = readFunctionalCurrency();
              if (functionalCurrency === request.foreignCurrency) {
                throw new ExchangeRateConflict({ code: 'company.exchange_rate_conflict' });
              }
              const previous = Schema.decodeUnknownSync(
                Schema.UndefinedOr(PreviousExchangeRateRecord),
              )(
                sqlite
                  .prepare(
                    `select foreign_units_per_functional_unit_nanos as rate, source
                     from exchange_rates where rate_date = ? and functional_currency = ?
                     and foreign_currency = ?`,
                  )
                  .get(request.rateDate, functionalCurrency, request.foreignCurrency),
              );
              const id = ulid(now);
              sqlite
                .prepare(
                  `insert into exchange_rates
                   (id, rate_date, functional_currency, foreign_currency,
                    foreign_units_per_functional_unit_nanos, source, imported_at, created_by_user_id)
                   values (?, ?, ?, ?, ?, 'manual', ?, ?)
                   on conflict (rate_date, functional_currency, foreign_currency) do update set
                     id = excluded.id,
                     foreign_units_per_functional_unit_nanos = excluded.foreign_units_per_functional_unit_nanos,
                     source = excluded.source,
                     imported_at = excluded.imported_at,
                     created_by_user_id = excluded.created_by_user_id`,
                )
                .run(
                  id,
                  request.rateDate,
                  functionalCurrency,
                  request.foreignCurrency,
                  request.foreignUnitsPerFunctionalUnitNanos,
                  now,
                  actorUserId,
                );
              audit.insert({
                action: 'company.exchange-rate-overridden',
                actorUserId,
                resourceType: 'exchange-rate',
                resourceId: `${request.rateDate}:${functionalCurrency}:${request.foreignCurrency}`,
                occurredAt: now,
                metadata: {
                  rate: String(request.foreignUnitsPerFunctionalUnitNanos),
                  previousRate: previous === undefined ? '' : String(previous.rate),
                  previousSource: previous?.source ?? '',
                },
              });
              return Schema.decodeUnknownSync(ExchangeRate)(
                sqlite
                  .prepare(selectRate)
                  .get(request.rateDate, functionalCurrency, request.foreignCurrency),
              );
            })
            .immediate(),
        catch: (cause) => {
          if (cause instanceof ExchangeRateConflict) return cause;
          return new DatabaseError({ operation: 'set.manual.exchange-rate', cause });
        },
      });
    });

    const importEcb = Effect.fn('ExchangeRates.importEcb')(function* (actorUserId: UlidValue) {
      const functionalCurrency = yield* Effect.try({
        try: readFunctionalCurrency,
        catch: (cause) => new DatabaseError({ operation: 'read.exchange-rate-currency', cause }),
      });
      const xml = yield* client.get(EcbExchangeRatesUrl).pipe(
        Effect.flatMap((response) => response.text),
        Effect.timeout(runtime.exchangeRates.requestTimeoutMillis),
        Effect.mapError(
          () => new ExchangeRateImportFailed({ code: 'company.exchange_rate_import_failed' }),
        ),
      );
      const imported = yield* Effect.try({
        try: () => parseEcbExchangeRates(xml, functionalCurrency),
        catch: () => new ExchangeRateImportFailed({ code: 'company.exchange_rate_import_failed' }),
      });
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          sqlite
            .transaction(() => {
              const statement = sqlite.prepare(
                `insert into exchange_rates
                 (id, rate_date, functional_currency, foreign_currency,
                  foreign_units_per_functional_unit_nanos, source, imported_at, created_by_user_id)
                 values (?, ?, ?, ?, ?, 'ecb', ?, null)
                 on conflict (rate_date, functional_currency, foreign_currency) do update set
                   id = excluded.id,
                   foreign_units_per_functional_unit_nanos = excluded.foreign_units_per_functional_unit_nanos,
                   imported_at = excluded.imported_at
                 where exchange_rates.source = 'ecb'`,
              );
              for (const rate of imported) {
                statement.run(
                  ulid(now),
                  rate.rateDate,
                  functionalCurrency,
                  rate.foreignCurrency,
                  rate.foreignUnitsPerFunctionalUnitNanos,
                  now,
                );
              }
              audit.insert({
                action: 'company.exchange-rate-imported',
                actorUserId,
                resourceType: 'company',
                resourceId: 'exchange-rates',
                occurredAt: now,
                metadata: { count: String(imported.length), functionalCurrency },
              });
              return readRates();
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'import.ecb.exchange-rates', cause }),
      });
    });

    return ExchangeRates.of({ list, setManual, importEcb });
  }),
);
