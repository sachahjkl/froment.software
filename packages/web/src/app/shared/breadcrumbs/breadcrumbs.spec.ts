import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Breadcrumbs } from './breadcrumbs';

describe('Breadcrumbs', () => {
  it('keeps focus when an ancestor query changes', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Breadcrumbs);
    fixture.componentRef.setInput('label', 'Breadcrumb');
    fixture.componentRef.setInput('current', 'Invoice');
    fixture.componentRef.setInput('items', [
      { label: 'Billing', path: ['/billing'], queryParams: { q: 'Audit' } },
    ]);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    link.focus();
    fixture.componentRef.setInput('items', [
      { label: 'Billing', path: ['/billing'], queryParams: { q: 'Review' } },
    ]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(link);
    expect(link.getAttribute('href')).toBe('/billing?q=Review');
  });
  it('uses real ancestor links and one non-interactive current page', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Breadcrumbs);
    fixture.componentRef.setInput('label', 'Breadcrumb');
    fixture.componentRef.setInput('items', [{ label: 'Clients', path: '/clients' }]);
    fixture.componentRef.setInput('current', 'Atlas');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('nav').getAttribute('aria-label')).toBe(
      'Breadcrumb',
    );
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/clients');
    const current = fixture.nativeElement.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Atlas');
    expect(current[0].querySelector('a,button')).toBeNull();
  });
  it('serializes each parent context independently', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Breadcrumbs);
    fixture.componentRef.setInput('label', 'Fil d’Ariane');
    fixture.componentRef.setInput('current', 'Encaissement');
    fixture.componentRef.setInput('items', [
      {
        label: 'Facturation',
        path: '/backoffice/facturation',
        queryParams: { q: 'Étude & audit', sort: 'due-asc' },
      },
      {
        label: 'Facture',
        path: ['/backoffice/invoices', 'example'],
        queryParams: { billingQ: 'Étude & audit', tab: 'receipts' },
      },
    ]);
    await fixture.whenStable();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a');
    const router = TestBed.inject(Router);
    expect(router.parseUrl(links[0]!.getAttribute('href')!).queryParams).toEqual({
      q: 'Étude & audit',
      sort: 'due-asc',
    });
    expect(router.parseUrl(links[1]!.getAttribute('href')!).queryParams).toEqual({
      billingQ: 'Étude & audit',
      tab: 'receipts',
    });
  });
});
