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
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('builds the mail link and owns the calendar link attributes', () => {
    const links = element.querySelectorAll<HTMLAnchorElement>('a');

    expect(links[0].textContent).toContain('Écrire');
    expect(links[0].href).toContain('subject=Besoin+logiciel');
    expect(links[0].href).toContain('body=Bonjour%2C+%C3%A9changeons.');
    expect(links[1].textContent).toContain('Planifier');
    expect(links[1].target).toBe('_blank');
    expect(links[1].rel).toBe('noreferrer');
  });
});
