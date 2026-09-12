import { convertToParamMap } from '@angular/router';
import { affairContext } from '../affairs/affair-filters';
import { commercialBreadcrumbs } from '../commercial-header';

describe('Commercial breadcrumbs', () => {
  const affair = { id: '01ARZ3NDEKTSV4RRFFQ69G5FAY', reference: 'DE-2026-000001' };

  it('preserves only the allowed context on the list and affair links', () => {
    const context = affairContext(
      convertToParamMap({
        view: 'active',
        q: 'Audit',
        sort: 'amount-desc',
        returnUrl: '//outside.example',
        version: '4',
      }),
    );
    expect(commercialBreadcrumbs(affair, context, 'fr')).toEqual([
      { path: ['/backoffice/affairs', 'active'], label: 'Affaires', queryParams: context },
      { path: ['/backoffice/affairs', affair.id], label: affair.reference, queryParams: context },
    ]);
    expect(context).not.toHaveProperty('returnUrl');
    expect(context).not.toHaveProperty('version');
  });

  it('keeps a list link when the document cannot load', () => {
    const context = affairContext(convertToParamMap({ view: 'invalid' }));
    expect(commercialBreadcrumbs(undefined, context, 'en')).toEqual([
      { path: ['/backoffice/affairs', 'attention'], label: 'Engagements', queryParams: context },
    ]);
  });
});
