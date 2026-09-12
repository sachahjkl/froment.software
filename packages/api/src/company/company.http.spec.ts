import Sqlite from 'better-sqlite3';
import { CompanySettings, ExchangeRate, ExchangeRateList } from '@froment/contracts';
import { Schema } from 'effect';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHttpTestServer, type HttpTestServer } from '../server/server.spec-helper.js';

describe('company settings HTTP lifecycle', () => {
  let server: HttpTestServer;

  beforeAll(async () => {
    server = await startHttpTestServer();
  }, 30_000);
  afterAll(async () => server.close());

  it('updates settings, initializes accounting, and locks the functional currency', async () => {
    const initialResponse = await fetch(`${server.baseUrl}/api/company`, {
      headers: server.sessionHeaders,
    });
    expect(initialResponse.status).toBe(200);
    const initial = Schema.decodeUnknownSync(CompanySettings)(await initialResponse.json());
    expect(initial).toMatchObject({
      jurisdiction: 'FR',
      functionalCurrency: 'EUR',
      accountingInitialized: false,
      defaultFiscalYearMonths: 12,
      retentionYears: 10,
    });

    const updateResponse = await fetch(`${server.baseUrl}/api/company`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        jurisdiction: 'FR',
        functionalCurrency: 'USD',
        fiscalYearStartMonth: 4,
        fiscalYearStartDay: 1,
        enabledModules: ['sales', 'purchasing', 'accounting'],
        retentionYears: 12,
        expectedVersion: initial.version,
      }),
    });
    expect(updateResponse.status).toBe(200);
    const updated = Schema.decodeUnknownSync(CompanySettings)(await updateResponse.json());
    expect(updated).toMatchObject({
      functionalCurrency: 'USD',
      fiscalYearStartMonth: 4,
      retentionYears: 12,
    });

    const initializeResponse = await fetch(`${server.baseUrl}/api/company/accounting/initialize`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ functionalCurrency: 'USD', expectedVersion: updated.version }),
    });
    expect(initializeResponse.status).toBe(200);
    const initialized = Schema.decodeUnknownSync(CompanySettings)(await initializeResponse.json());
    expect(initialized.accountingInitialized).toBe(true);

    const lockedResponse = await fetch(`${server.baseUrl}/api/company`, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        jurisdiction: 'FR',
        functionalCurrency: 'EUR',
        fiscalYearStartMonth: 4,
        fiscalYearStartDay: 1,
        enabledModules: initialized.enabledModules,
        retentionYears: 12,
        expectedVersion: initialized.version,
      }),
    });
    expect(lockedResponse.status).toBe(409);
    await expect(lockedResponse.json()).resolves.toMatchObject({
      code: 'company.functional_currency_locked',
    });
  });

  it('rejects unauthenticated reads and repeated initialization', async () => {
    expect((await fetch(`${server.baseUrl}/api/company`)).status).toBe(401);
    const current = Schema.decodeUnknownSync(CompanySettings)(
      await (
        await fetch(`${server.baseUrl}/api/company`, { headers: server.sessionHeaders })
      ).json(),
    );
    const response = await fetch(`${server.baseUrl}/api/company/accounting/initialize`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        functionalCurrency: current.functionalCurrency,
        expectedVersion: current.version,
      }),
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'company.accounting_already_initialized',
    });
  });

  it('stores and audits manual exchange-rate overrides', async () => {
    const url = `${server.baseUrl}/api/company/exchange-rates`;
    const settings = Schema.decodeUnknownSync(CompanySettings)(
      await (
        await fetch(`${server.baseUrl}/api/company`, { headers: server.sessionHeaders })
      ).json(),
    );
    const foreignCurrency = settings.functionalCurrency === 'EUR' ? 'USD' : 'EUR';
    expect((await fetch(url)).status).toBe(401);
    const firstResponse = await fetch(url, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        rateDate: '2026-09-11',
        foreignCurrency,
        foreignUnitsPerFunctionalUnitNanos: 900_000_000,
      }),
    });
    expect(firstResponse.status).toBe(200);
    const first = Schema.decodeUnknownSync(ExchangeRate)(await firstResponse.json());
    expect(first).toMatchObject({
      rateDate: '2026-09-11',
      functionalCurrency: settings.functionalCurrency,
      foreignCurrency,
      source: 'manual',
      foreignUnitsPerFunctionalUnitNanos: 900_000_000,
    });

    const secondResponse = await fetch(url, {
      method: 'PUT',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        rateDate: '2026-09-11',
        foreignCurrency,
        foreignUnitsPerFunctionalUnitNanos: 910_000_000,
      }),
    });
    expect(secondResponse.status).toBe(200);
    const rates = Schema.decodeUnknownSync(ExchangeRateList)(
      await (await fetch(url, { headers: server.sessionHeaders })).json(),
    );
    expect(rates).toHaveLength(1);
    expect(rates[0]?.foreignUnitsPerFunctionalUnitNanos).toBe(910_000_000);

    const database = new Sqlite(server.databaseFilename, { readonly: true });
    try {
      expect(
        database
          .prepare(
            "select count(*) from audit_events where action = 'company.exchange-rate-overridden'",
          )
          .pluck()
          .get(),
      ).toBe(2);
    } finally {
      database.close();
    }
  });
});
