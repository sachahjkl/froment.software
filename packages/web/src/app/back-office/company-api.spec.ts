import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CompanyApi } from './company-api';

const settings = {
  jurisdiction: 'FR',
  functionalCurrency: 'EUR',
  accountingInitialized: false,
  fiscalYearStartMonth: 1,
  fiscalYearStartDay: 1,
  defaultFiscalYearMonths: 12,
  enabledModules: ['sales', 'accounting'],
  retentionYears: 10,
  version: 1,
  updatedAt: 0,
};

describe('CompanyApi', () => {
  it('reads, updates, and initializes company settings', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(CompanyApi);
    const http = TestBed.inject(HttpTestingController);

    const get = api.get();
    http.expectOne('/api/company').flush(settings);
    await expect(get).resolves.toEqual({ success: true, result: settings });

    const updatePayload = {
      jurisdiction: 'FR' as const,
      functionalCurrency: 'EUR',
      fiscalYearStartMonth: 4,
      fiscalYearStartDay: 1,
      enabledModules: ['sales' as const, 'accounting' as const],
      retentionYears: 12,
      expectedVersion: 1,
    };
    const update = api.update(updatePayload);
    const updateRequest = http.expectOne('/api/company');
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual(updatePayload);
    updateRequest.flush({ ...settings, ...updatePayload, version: 2, updatedAt: 1 });
    await expect(update).resolves.toMatchObject({ success: true });

    const initializePayload = { functionalCurrency: 'EUR', expectedVersion: 2 };
    const initialize = api.initializeAccounting(initializePayload);
    const initializeRequest = http.expectOne('/api/company/accounting/initialize');
    expect(initializeRequest.request.method).toBe('POST');
    expect(initializeRequest.request.body).toEqual(initializePayload);
    initializeRequest.flush({ ...settings, accountingInitialized: true, version: 3, updatedAt: 2 });
    await expect(initialize).resolves.toMatchObject({ success: true });

    const rate = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      rateDate: '2026-09-11',
      functionalCurrency: 'EUR',
      foreignCurrency: 'USD',
      foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      source: 'ecb',
      importedAt: 1,
      createdByUserId: null,
    };
    const listRates = api.listExchangeRates();
    http.expectOne('/api/company/exchange-rates').flush([rate]);
    await expect(listRates).resolves.toEqual({ success: true, result: [rate] });

    const manualPayload = {
      rateDate: '2026-09-11',
      foreignCurrency: 'USD',
      foreignUnitsPerFunctionalUnitNanos: 1_200_000_000,
    };
    const setRate = api.setExchangeRate(manualPayload);
    const setRateRequest = http.expectOne('/api/company/exchange-rates');
    expect(setRateRequest.request.method).toBe('PUT');
    expect(setRateRequest.request.body).toEqual(manualPayload);
    setRateRequest.flush({ ...rate, ...manualPayload, source: 'manual' });
    await expect(setRate).resolves.toMatchObject({ success: true });

    const importRates = api.importExchangeRates();
    const importRequest = http.expectOne('/api/company/exchange-rates/ecb');
    expect(importRequest.request.method).toBe('POST');
    importRequest.flush([rate]);
    await expect(importRates).resolves.toEqual({ success: true, result: [rate] });

    http.verify();
  });
});
