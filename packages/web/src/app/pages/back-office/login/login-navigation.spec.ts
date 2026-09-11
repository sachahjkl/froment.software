import { DefaultUrlSerializer } from '@angular/router';
import { loginDestination } from './login-navigation';

describe('loginDestination', () => {
  const serializer = new DefaultUrlSerializer();
  const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

  it.each([
    '/backoffice/client',
    '/backoffice/client?quote=' + id,
    '/backoffice/client/account',
    '/backoffice/client/account/security',
    '/backoffice/client/account/passkeys',
    '/backoffice/client/account/sessions',
    '/backoffice/client/account/preferences',
    ...['quote', 'order', 'invoice'].map(
      (kind) => `/backoffice/client/documents/${kind}/${id}?q=audit#document`,
    ),
  ])('preserves the internal client destination %s', (url) => {
    expect(loginDestination('client', url, serializer)).toBe(url);
  });

  it.each([
    null,
    'https://example.test/backoffice/client',
    '//example.test/backoffice/client',
    '/\\example.test/backoffice/client',
    '/%2F%2Fexample.test/backoffice/client',
    'javascript:alert(1)',
    '/backoffice/client-other',
    '/backoffice/clients',
    '/backoffice/client/account/unknown',
    '/backoffice/client;external=1',
    '/backoffice/client(aux:backoffice/dashboard)',
    '/backoffice/client/documents/quote/invalid',
    `/backoffice/client/documents/refund/${id}`,
    `/backoffice/client/documents/quote/${id}/edit`,
    '/backoffice/client?malformed=%',
  ])('rejects an external or unsupported destination %s', (url) => {
    expect(loginDestination('client', url, serializer)).toBe('/backoffice/client');
  });

  it('keeps administrator sign-in separate from client destinations', () => {
    expect(loginDestination('administrator', '/backoffice/client', serializer)).toBe(
      '/backoffice/dashboard',
    );
  });
});
