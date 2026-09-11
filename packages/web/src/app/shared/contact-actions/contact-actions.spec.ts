import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactActions } from './contact-actions';

describe('ContactActions', () => {
  let fixture: ComponentFixture<ContactActions>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ContactActions] }).compileComponents();
    fixture = TestBed.createComponent(ContactActions);
    fixture.componentRef.setInput('mailLabel', 'Écrire');
    fixture.componentRef.setInput('bookLabel', 'Planifier');
    fixture.componentRef.setInput('subject', 'Besoin logiciel');
    fixture.componentRef.setInput('body', 'Bonjour, échangeons.');
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  it('builds the mail link and owns the calendar link attributes', () => {
    const links = element.querySelectorAll<HTMLAnchorElement>('a');

    expect(links[0].textContent).toContain('Écrire');
    expect(links[0].href).toBe(
      'mailto:contact@froment.software?subject=Besoin%20logiciel&body=Bonjour%2C%20%C3%A9changeons.',
    );
    expect(links[1].textContent).toContain('Planifier');
    expect(links[1].target).toBe('_blank');
    expect(links[1].rel).toBe('noreferrer');
  });

  it('updates the mail link when its subject and body change', async () => {
    fixture.componentRef.setInput('subject', 'C++');
    fixture.componentRef.setInput('body', 'Bonjour\nMerci');
    await fixture.whenStable();

    expect(element.querySelector('a')?.href).toBe(
      'mailto:contact@froment.software?subject=C%2B%2B&body=Bonjour%0D%0AMerci',
    );
  });
});
