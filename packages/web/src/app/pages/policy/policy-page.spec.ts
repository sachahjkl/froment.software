import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { policies } from './policy-documents';
import { PolicyPage } from './policy-page';

describe('PolicyPage', () => {
  it('renders unique accessible section identifiers and policy links', async () => {
    await TestBed.configureTestingModule({
      imports: [PolicyPage],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PolicyPage);
    fixture.componentRef.setInput('policy', policies.legal);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const sections = Array.from(element.querySelectorAll<HTMLElement>('.policy-section'));
    const ids = sections.map((section) => section.querySelector('h2')?.id);
    expect(new Set(ids).size).toBe(policies.legal.sections.length);
    expect(
      sections.every(
        (section) => section.getAttribute('aria-labelledby') === section.querySelector('h2')?.id,
      ),
    ).toBe(true);
    expect(element.querySelector('a[href="mailto:contact@froment.software"]')).not.toBeNull();
    expect(element.querySelector('a[href="/privacy"]')).not.toBeNull();
  });
});
