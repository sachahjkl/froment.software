import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { BackOfficeNav } from './back-office-nav';

describe('BackOfficeNav', () => {
  it('marks only one subject active, including associated editors', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const fixture = TestBed.createComponent(BackOfficeNav);
    const router = TestBed.inject(Router);
    for (const [path, selected] of [
      ['quotes/new', 'affaires'],
      ['orders/example', 'affaires'],
      ['invoices/example', 'facturation'],
      ['clients/example/profile', 'clients'],
      ['catalogue/active', 'catalogue'],
      ['catalogue/example/edit', 'catalogue'],
      ['configuration/entreprise', 'configuration'],
      ['equipe/invitations/new', 'equipe'],
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
    expect(root.querySelectorAll('nav a')).toHaveLength(12);
    expect(
      [...root.querySelectorAll('nav section:last-child a')].map((link) =>
        link.getAttribute('href'),
      ),
    ).toEqual([
      '/backoffice/equipe',
      '/backoffice/api',
      '/backoffice/services',
      '/backoffice/audit',
      '/backoffice/configuration',
    ]);
    expect(root.querySelector('a[href="/backoffice/account"]')).toBeNull();
  });
});
