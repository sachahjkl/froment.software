import { convertToParamMap } from '@angular/router';
import {
  catalogFilterQuery,
  catalogListQuery,
  catalogReturnView,
  catalogTaxRate,
} from './catalog-list-query';

describe('catalog list query', () => {
  it('keeps only supported return state and bounds search text', () => {
    const params = convertToParamMap({
      q: 'a'.repeat(150),
      sort: 'invalid',
      view: 'https://outside.example',
      returnUrl: '/backoffice/sign-out',
    });
    expect(catalogListQuery(params)).toEqual({
      q: 'a'.repeat(120),
      sort: 'none',
      tax: null,
    });
    expect(catalogReturnView(params)).toBe('active');
    expect(catalogReturnView(convertToParamMap({ view: 'archived' }))).toBe('archived');
  });

  it.each(['description', 'quantity', 'price', 'tax', 'status'])(
    'accepts both sort directions for %s',
    (column) => {
      for (const direction of ['asc', 'desc']) {
        const sort = `${column}-${direction}`;
        expect(catalogListQuery(convertToParamMap({ sort, tax: '550' }))).toEqual({
          q: '',
          sort,
          tax: 550,
        });
      }
    },
  );

  it.each([undefined, null, '', 'invalid', 'none'])('uses the initial sort for %s', (sort) => {
    const query = catalogListQuery(convertToParamMap({ q: 'Audit', tax: '2000', sort }));
    expect(query.sort).toBe('none');
    expect(catalogFilterQuery(query)).toEqual({ q: 'Audit', tax: 2000, sort: undefined });
    const params = catalogFilterQuery(query);
    expect(catalogListQuery(convertToParamMap({ ...params, tax: String(params.tax) }))).toEqual(
      query,
    );
  });

  it.each(['0', '550', '2000', '10000'])(
    'accepts the VAT rate %s in integer basis points',
    (value) => {
      expect(catalogTaxRate(value)).toBe(Number(value));
      expect(catalogListQuery(convertToParamMap({ tax: value })).tax).toBe(Number(value));
    },
  );

  it.each([null, '', ' ', '-1', '10001', '550.5', 'NaN', 'Infinity', '20%', '0x10', '2e3'])(
    'discards an invalid VAT filter: %s',
    (value) => {
      expect(catalogTaxRate(value)).toBeNull();
    },
  );
});
