import { convertToParamMap } from '@angular/router';
import { clientNavigationQuery } from './client-navigation';

const context = {
  q: 'Acme & Associés',
  view: 'archived',
  country: 'France',
  contact: 'incomplete',
  sort: 'name-desc',
  clientAffairQ: 'Conseil',
  clientAffairSort: 'amountDesc',
  clientAffairStatus: 'accepted',
  clientDocumentQ: 'FAC',
  clientDocumentSort: 'dateAsc',
  clientDocumentType: 'invoice',
  clientAccessQ: 'portal',
  clientAccessSort: 'emailDesc',
  clientAccessFrom: '2026-09-01',
  clientAccessTo: '2026-09-30',
};

describe('Client navigation query', () => {
  it('retains the validated client list context and all three table queries', () => {
    expect(clientNavigationQuery(convertToParamMap(context))).toEqual(context);
  });

  it('excludes unknown parameters, credentials and arbitrary return URLs', () => {
    expect(
      clientNavigationQuery(
        convertToParamMap({
          ...context,
          returnUrl: 'https://example.test/redirect',
          token: 'secret-token',
          password: 'secret-password',
          clientAccessFilter: 'revoked',
          clientDocumentSecret: 'secret-document',
          clientAffairReturnUrl: '/backoffice/team',
        }),
      ),
    ).toEqual(context);
  });

  it('uses the existing query parsers to reject invalid values and omit defaults', () => {
    const query = clientNavigationQuery(
      convertToParamMap({
        q: 'x'.repeat(121),
        country: 'y'.repeat(121),
        view: 'unknown',
        contact: 'invalid',
        sort: 'secretDesc',
        clientAffairQ: ['one', 'two'],
        clientAffairSort: 'none',
        clientAffairStatus: 'all',
        clientDocumentQ: 'z'.repeat(121),
        clientDocumentSort: ['dateAsc', 'dateDesc'],
        clientDocumentType: 'unknown',
        clientAccessQ: '',
        clientAccessSort: 'secretDesc',
        clientAccessFrom: '2026-10-01',
        clientAccessTo: '2026-09-30',
      }),
    );
    expect(
      Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)),
    ).toEqual({ q: 'x'.repeat(120), country: 'y'.repeat(120) });
  });
});
