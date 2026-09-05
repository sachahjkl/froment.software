import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { DocumentIssues } from './document-issues';

describe('DocumentIssues', () => {
  it('shows the affected fields, correction links and invoice recovery instructions', async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentIssues],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(DocumentIssues);
    fixture.componentRef.setInput('clientId', '01ARZ3NDEKTSV4RRFFQ69G5FAV');
    fixture.componentRef.setInput('kind', 'invoice');
    fixture.componentRef.setInput('issues', [
      { party: 'issuer', field: 'email', reason: 'invalid_email' },
      { party: 'client', field: 'city', reason: 'required' },
    ]);
    TestBed.inject(I18nService).setLanguage('fr');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).toContain('Ville : champ requis.');
    expect(element.textContent).toContain('cochez l’actualisation');
    expect(Array.from(element.querySelectorAll('a'), (link) => link.getAttribute('href'))).toEqual([
      '/backoffice/configuration/entreprise',
      '/backoffice/clients/01ARZ3NDEKTSV4RRFFQ69G5FAV/profile',
    ]);
  });
});
