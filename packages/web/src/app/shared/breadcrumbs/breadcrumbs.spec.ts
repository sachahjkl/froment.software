import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Breadcrumbs } from './breadcrumbs';

describe('Breadcrumbs', () => {
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
});
