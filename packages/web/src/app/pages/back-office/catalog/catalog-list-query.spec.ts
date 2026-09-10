import { convertToParamMap } from '@angular/router';
import { catalogListQuery, catalogReturnView } from './catalog-list-query';

describe('catalog list query', () => {
  it('keeps only supported return state and bounds search text', () => {
    const params = convertToParamMap({
      q: 'a'.repeat(150),
      sort: 'invalid',
      view: 'https://outside.example',
      returnUrl: '/backoffice/sign-out',
    });
    expect(catalogListQuery(params)).toEqual({ q: 'a'.repeat(120), sort: 'description-asc' });
    expect(catalogReturnView(params)).toBe('active');
    expect(catalogReturnView(convertToParamMap({ view: 'archived' }))).toBe('archived');
  });
});
