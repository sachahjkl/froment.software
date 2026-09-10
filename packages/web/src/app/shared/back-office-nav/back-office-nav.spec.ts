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
      ['invoices/example', 'facturation'],
      ['clients/example/profile', 'clients'],
      ['catalogue/active', 'catalogue'],
      ['catalogue/example/edit', 'catalogue'],
      ['configuration/services/resend', 'configuration'],
    ]) {
      await router.navigateByUrl(`/backoffice/${path}`);
      await fixture.whenStable();
      const links = fixture.nativeElement.querySelectorAll('a[aria-current="page"]');
      expect(links.length).toBe(1);
      expect(links[0].getAttribute('href')).toBe(`/backoffice/${selected}`);
    }
  });
});
