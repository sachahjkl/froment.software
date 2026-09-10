import { convertToParamMap } from '@angular/router';
import { type ClientAccessValue } from '@froment/contracts';
import { Schema } from 'effect';
import {
  ClientAccessPeriod,
  clientAccessPeriod,
  clientAccessPeriodParams,
  clientAccessMatchesPeriod,
} from './client-access-period';

function access(createdAt: number): ClientAccessValue {
  return {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    email: 'portal@example.test',
    createdAt,
  };
}

describe('Client access period', () => {
  it('reads only the access period keys and emits only those keys when cleared', () => {
    expect(
      clientAccessPeriod(
        convertToParamMap({
          from: '2000-01-01',
          to: '2000-12-31',
          q: 'Acme',
          clientAccessFrom: '2026-09-01',
          clientAccessTo: '2026-09-30',
        }),
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(clientAccessPeriodParams({})).toEqual({ clientAccessFrom: null, clientAccessTo: null });
  });

  it('rejects invalid dates, repeated bounds and reversed ranges', () => {
    for (const params of [
      { clientAccessFrom: '2026-02-30' },
      { clientAccessFrom: ['2026-09-01', '2026-09-02'] },
      { clientAccessFrom: '2026-10-01', clientAccessTo: '2026-09-30' },
    ]) {
      expect(clientAccessPeriod(convertToParamMap(params)).from).toBeUndefined();
      expect(clientAccessPeriod(convertToParamMap(params)).to).toBeUndefined();
    }
    expect(Schema.is(ClientAccessPeriod)({ from: '2026-02-29' })).toBe(false);
    expect(Schema.is(ClientAccessPeriod)({ from: '2024-02-29' })).toBe(true);
  });

  it('includes both complete local boundary days, including the last millisecond', () => {
    const period = { from: '2026-09-01', to: '2026-09-30' };
    expect(
      clientAccessMatchesPeriod(access(new Date(2026, 8, 1, 0, 0, 0, 0).getTime()), period),
    ).toBe(true);
    expect(
      clientAccessMatchesPeriod(access(new Date(2026, 8, 30, 23, 59, 59, 999).getTime()), period),
    ).toBe(true);
    expect(
      clientAccessMatchesPeriod(access(new Date(2026, 7, 31, 23, 59, 59, 999).getTime()), period),
    ).toBe(false);
    expect(
      clientAccessMatchesPeriod(access(new Date(2026, 9, 1, 0, 0, 0, 0).getTime()), period),
    ).toBe(false);
  });

  it('supports open bounds and local days across daylight saving changes', () => {
    const march = access(new Date(2026, 2, 29, 23, 59, 59, 999).getTime());
    expect(clientAccessMatchesPeriod(march, { from: '2026-03-29', to: '2026-03-29' })).toBe(true);
    expect(clientAccessMatchesPeriod(march, { from: '2026-03-29' })).toBe(true);
    expect(clientAccessMatchesPeriod(march, { to: '2026-03-28' })).toBe(false);
    expect(clientAccessMatchesPeriod(march, {})).toBe(true);
  });
});
