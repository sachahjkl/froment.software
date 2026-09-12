import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BackOfficeNav } from './back-office-nav';
import { accountFixture, provideAccount } from '@backoffice/account.spec-helper';

beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));

describe('BackOfficeNav', () => {
  it('hides unauthorized subjects and clears navigation when the account becomes unknown', async () => {
    const context = accountFixture([
      'client.read',
      'quote.read',
      'order.read',
      'invoice.read',
      'bank.read',
      'issuer.read',
      'catalog.read',
    ]);
    TestBed.configureTestingModule({ providers: [provideRouter([]), context.provider] });
    const fixture = TestBed.createComponent(BackOfficeNav);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('a[href="/backoffice/clients"]')).not.toBeNull();
    expect(root.querySelector('a[href="/backoffice/team"]')).toBeNull();
    expect(root.querySelector('a[href="/backoffice/emails"]')).toBeNull();
    context.account.set(undefined);
    await fixture.whenStable();
    expect(root.querySelector('a')).toBeNull();
  });
  it('marks only one subject active, including associated editors', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const fixture = TestBed.createComponent(BackOfficeNav);
    const router = TestBed.inject(Router);
    for (const [path, selected] of [
      ['quotes/new', 'affairs'],
      ['orders/example', 'affairs'],
      ['invoices/example', 'billing'],
      ['clients/example/profile', 'clients'],
      ['suppliers/example', 'suppliers'],
      ['catalog/active', 'catalog'],
      ['catalog/example/edit', 'catalog'],
      ['configuration/issuer', 'configuration'],
      ['team/invitations/new', 'team'],
      ['api/new', 'api'],
      ['services/resend/tests/new', 'services'],
      ['services/stripe/tests/example', 'services'],
      ['audit', 'audit'],
    ]) {
      await router.navigateByUrl(`/backoffice/${path}`);
      await fixture.whenStable();
      const links = fixture.nativeElement.querySelectorAll('a[aria-current="page"]');
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toBe(`/backoffice/${selected}`);
    }
  });
  it('keeps team, API, services and audit separate from company configuration', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(BackOfficeNav);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('nav section')).toHaveLength(2);
    expect(root.querySelector('a[href="/backoffice/suppliers"]')).not.toBeNull();
    expect(
      [...root.querySelectorAll('nav section:last-child a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/backoffice/team',
      '/backoffice/api',
      '/backoffice/services',
      '/backoffice/audit',
      '/backoffice/configuration',
    ]);
    expect(root.querySelector('a[href="/backoffice/account"]')).toBeNull();
  });
});
