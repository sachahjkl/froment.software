import { convertToParamMap } from '@angular/router';
import { QuoteSummary, Ulid } from '@froment/contracts';
import { Schema } from 'effect';
import { affairContext, affairSort } from './affair-filters';
import { affairColumns, compareAffairs, nextAffairSort } from './affair-sort';

const first = {
  quote: Schema.decodeUnknownSync(QuoteSummary)({
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
    reference: 'DE-2026-000001',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
    clientDisplayName: 'Équipement',
    status: 'draft',
    version: 1,
    title: 'Lot 2',
    currency: 'EUR',
    totalCents: 900,
    updatedAt: '2026-01-31T12:00:00.000Z',
  }),
  stageLabel: 'Brouillon',
};
const second = {
  ...first,
  quote: { ...first.quote, id: Schema.decodeUnknownSync(Ulid)('01ARZ3NDEKTSV4RRFFQ69G5FAC') },
};
const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });

describe('Affair sort', () => {
  it.each(affairColumns)('validates both directions for $key and keeps the context', ({ key }) => {
    const ascending = nextAffairSort('updated-desc', key);
    const descending = nextAffairSort(ascending, key);
    for (const sort of [ascending, descending]) {
      const params = convertToParamMap({
        q: 'Lot',
        stage: 'draft',
        client: first.quote.clientId,
        view: 'all',
        sort,
      });
      expect(affairSort(params)).toBe(sort);
      expect(affairContext(params)).toEqual({
        q: 'Lot',
        stage: 'draft',
        client: first.quote.clientId,
        view: 'all',
        sort,
      });
    }
  });
  it.each(affairColumns)(
    'uses a stable ascending ID tie-break for both $key directions',
    ({ key }) => {
      const rows = [second, first];
      const ascending = nextAffairSort('updated-desc', key);
      for (const sort of [ascending, nextAffairSort(ascending, key)]) {
        expect(rows.toSorted((left, right) => compareAffairs(left, right, sort, collator))).toEqual(
          [first, second],
        );
        expect(rows).toEqual([second, first]);
      }
    },
  );
  it('uses locale collation and natural numbers for text, not formatted money or dates', () => {
    const later = {
      ...second,
      quote: {
        ...second.quote,
        title: 'Lot 10',
        clientDisplayName: 'Zebra',
        totalCents: 1000,
        updatedAt: '2026-02-01T08:00:00.000Z',
      },
    };
    expect(compareAffairs(first, later, 'title-asc', collator)).toBeLessThan(0);
    expect(compareAffairs(first, later, 'client-asc', collator)).toBeLessThan(0);
    expect(compareAffairs(first, later, 'amount-asc', collator)).toBeLessThan(0);
    expect(compareAffairs(first, later, 'updated-asc', collator)).toBeLessThan(0);
  });
  it('normalizes an invalid sort without carrying an arbitrary return URL', () => {
    expect(
      affairContext(
        convertToParamMap({ sort: 'nextAction-desc', returnUrl: 'https://invalid.test' }),
      ),
    ).toEqual({
      q: undefined,
      stage: undefined,
      client: undefined,
      view: undefined,
      sort: 'updated-desc',
    });
    expect(affairSort(convertToParamMap({}))).toBe('updated-desc');
  });
});
