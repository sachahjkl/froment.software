import { describe, expect, it } from 'vitest';

import { parseEcbExchangeRates } from './exchange-rates.js';

const fixture = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01">
  <Cube>
    <Cube time="2026-09-11">
      <Cube currency="USD" rate="1.1000"/>
      <Cube currency="GBP" rate="0.8000"/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

describe('ECB exchange-rate parsing', () => {
  it('keeps ECB euro quotations for a euro functional currency', () => {
    expect(parseEcbExchangeRates(fixture, 'EUR')).toEqual([
      {
        rateDate: '2026-09-11',
        foreignCurrency: 'USD',
        foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      },
      {
        rateDate: '2026-09-11',
        foreignCurrency: 'GBP',
        foreignUnitsPerFunctionalUnitNanos: 800_000_000,
      },
    ]);
  });

  it('derives cross-rates for a non-euro functional currency', () => {
    expect(parseEcbExchangeRates(fixture, 'USD')).toEqual([
      {
        rateDate: '2026-09-11',
        foreignCurrency: 'EUR',
        foreignUnitsPerFunctionalUnitNanos: 909_090_909,
      },
      {
        rateDate: '2026-09-11',
        foreignCurrency: 'GBP',
        foreignUnitsPerFunctionalUnitNanos: 727_272_727,
      },
    ]);
  });

  it('rejects malformed input and an unavailable functional currency', () => {
    expect(() => parseEcbExchangeRates('<broken>', 'EUR')).toThrow();
    expect(() => parseEcbExchangeRates(fixture, 'JPY')).toThrow(
      'company.exchange_rate_functional_currency_missing',
    );
  });
});
