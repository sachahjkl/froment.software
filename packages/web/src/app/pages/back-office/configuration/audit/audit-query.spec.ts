import { convertToParamMap } from '@angular/router';
import { auditQuery } from './audit-query';

const cursor = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('auditQuery', () => {
  it('restores filters, direction, cursor and limit from a shared URL', () => {
    expect(
      auditQuery(
        convertToParamMap({
          cursor,
          direction: 'newer',
          limit: '25',
          action: 'quote.created',
          resourceType: 'quote',
        }),
      ),
    ).toEqual({
      cursor,
      direction: 'newer',
      limit: 25,
      action: 'quote.created',
      resourceType: 'quote',
    });
    expect(auditQuery(convertToParamMap({}))).toEqual({});
    expect(auditQuery(convertToParamMap({ limit: '75' }))).toEqual({ limit: 75 });
  });

  it.each([
    { cursor: 'bad' },
    { cursor: [cursor, cursor] },
    { limit: '0' },
    { limit: '9007199254740992' },
    { limit: '1.5' },
    { limit: ['2', '3'] },
    { action: 'Quote created' },
    { action: ['quote.created', 'invoice.created'] },
    { resourceType: 'Quote' },
    { direction: 'newer' },
    { direction: 'back' },
  ])('rejects invalid parameters instead of loading an unfiltered page: %j', (params) => {
    expect(auditQuery(convertToParamMap(params))).toBeUndefined();
  });
});
