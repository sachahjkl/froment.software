import { convertToParamMap } from '@angular/router';
import { portalFilters, portalFilterQuery } from './portal-filters';

describe('portal filters', () => {
  it('bounds the query and removes unknown filters from return links', () => {
    const filters = portalFilters(
      convertToParamMap({
        q: 'x'.repeat(200),
        kind: 'unknown',
        status: 'unknown',
        sort: 'unknown',
        unrelated: 'value',
      }),
    );
    expect(filters).toEqual({
      search: 'x'.repeat(120),
      kind: 'all',
      status: 'all',
      sort: 'none',
    });
    expect(portalFilterQuery(filters)).toEqual({
      q: 'x'.repeat(120),
      kind: undefined,
      status: undefined,
      sort: undefined,
    });
  });

  it('keeps valid search, document kind, and status on return links', () => {
    const filters = portalFilters(
      convertToParamMap({ q: 'Security', kind: 'invoice', status: 'open', sort: 'amount-asc' }),
    );
    expect(portalFilterQuery(filters)).toEqual({
      q: 'Security',
      kind: 'invoice',
      status: 'open',
      sort: 'amount-asc',
    });
  });

  it.each([
    'none',
    'reference-asc',
    'reference-desc',
    'kind-asc',
    'kind-desc',
    'status-asc',
    'status-desc',
    'date-asc',
    'date-desc',
    'amount-asc',
    'amount-desc',
  ])('round trips the validated sort %s', (sort) => {
    const filters = portalFilters(convertToParamMap({ sort }));
    expect(filters.sort).toBe(sort);
    expect(portalFilters(convertToParamMap(portalFilterQuery(filters)))).toEqual(filters);
  });

  it.each([undefined, null, '', 'invalid', 'none'])('uses the initial sort for %s', (sort) => {
    const filters = portalFilters(
      convertToParamMap({ q: 'Security', kind: 'invoice', status: 'open', sort }),
    );
    expect(filters.sort).toBe('none');
    expect(portalFilterQuery(filters)).toEqual({
      q: 'Security',
      kind: 'invoice',
      status: 'open',
      sort: undefined,
    });
  });
});
