import { convertToParamMap } from '@angular/router';
import { clientFilters, clientFilterQuery, clientView } from './client-filters';

describe('client filters', () => {
  it('validates sorting and the return view and bounds text filters', () => {
    const filters = clientFilters(
      convertToParamMap({
        q: 'x'.repeat(200),
        country: 'y'.repeat(200),
        contact: 'unknown',
        sort: 'unknown',
        unrelated: 'value',
      }),
    );
    expect(filters).toEqual({
      search: 'x'.repeat(120),
      country: 'y'.repeat(120),
      contact: 'all',
      sort: 'name-asc',
    });
    expect(clientFilterQuery(filters)).toEqual({
      q: 'x'.repeat(120),
      country: 'y'.repeat(120),
      contact: undefined,
      sort: undefined,
    });
    expect(clientView('unknown')).toBe('active');
    expect(clientView(null)).toBe('active');
    expect(clientView('archived')).toBe('archived');
    expect(clientView('all')).toBe('all');
  });

  it.each(['name-asc', 'name-desc', 'country-asc', 'country-desc', 'date-asc', 'date-desc'])(
    'preserves the validated sort %s with filters',
    (sort) => {
      const filters = clientFilters(
        convertToParamMap({ q: 'Audit', country: 'France', contact: 'incomplete', sort }),
      );
      expect(filters.sort).toBe(sort);
      expect(clientFilters(convertToParamMap(clientFilterQuery(filters)))).toEqual(filters);
    },
  );
});
