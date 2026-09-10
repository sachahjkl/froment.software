import { convertToParamMap } from '@angular/router';
import { affairContext } from '../affairs/affair-filters';
import { commercialAffairBack } from '../commercial-header';
import { quoteIdentifier } from './quote-values';

describe('Commercial detail back navigation', () => {
  const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';

  it('returns to the loaded quote affair', () => {
    expect(commercialAffairBack(quoteId, 'active')).toEqual({
      link: ['/backoffice/affaires', quoteId],
      label: 'commercial.backAffair',
    });
  });

  it('returns to the selected list when the document cannot load', () => {
    expect(commercialAffairBack(undefined, 'completed')).toEqual({
      link: ['/backoffice/affaires', 'completed'],
      label: 'backOffice.backToAffairs',
    });
  });

  it('uses the default list for invalid identifiers or views', () => {
    const context = affairContext(convertToParamMap({ view: 'invalid', version: '4', q: 'Audit' }));
    expect(commercialAffairBack(quoteIdentifier('invalid'), context.view)).toEqual({
      link: ['/backoffice/affaires', 'attention'],
      label: 'backOffice.backToAffairs',
    });
    expect(context.q).toBe('Audit');
    expect(context).not.toHaveProperty('version');
    expect(commercialAffairBack(undefined, undefined).link).toEqual([
      '/backoffice/affaires',
      'attention',
    ]);
  });
});
