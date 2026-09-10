import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

const languageStorageKey = 'froment.software.language';

@Component({
  template: '<p>{{ i18n.plural("configurationWorkspace.tokenConfirm", { count: 2, name }) }}</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class PluralTextExample {
  readonly i18n = inject(I18nService);
  readonly name = '<img src=x onerror="alert(1)">';
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('applies explicit French and English choices to the document and storage', () => {
    const service = TestBed.inject(I18nService);

    service.setLanguage('en');
    TestBed.tick();

    expect(service.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dataset['language']).toBe('en');
    expect(localStorage.getItem(languageStorageKey)).toBe('en');

    service.setLanguage('fr');
    TestBed.tick();

    expect(service.language()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dataset['language']).toBe('fr');
    expect(localStorage.getItem(languageStorageKey)).toBe('fr');
  });

  it('uses the current language for each plural counter', () => {
    const service = TestBed.inject(I18nService);
    service.setLanguage('fr');
    expect(service.plural('listControls.optionCount', { count: 0 })).toBe('0 résultat');
    expect(service.plural('listControls.optionCount', { count: 1 })).toBe('1 résultat');
    expect(service.plural('listControls.optionCount', { count: 2 })).toBe('2 résultats');
    expect(service.plural('listControls.optionCount', { count: 1_000_000 })).toBe(
      '1000000 résultats',
    );
    service.setLanguage('en');
    expect(service.plural('listControls.optionCount', { count: 0 })).toBe('0 results');
    expect(service.plural('listControls.optionCount', { count: 1 })).toBe('1 result');
    expect(service.plural('listControls.optionCount', { count: 2 })).toBe('2 results');
    expect(service.plural('listControls.optionCount', { count: 1_000_000 })).toBe(
      '1000000 results',
    );
  });

  it('rejects invalid plural counters without changing the language', () => {
    const service = TestBed.inject(I18nService);
    service.setLanguage('en');
    expect(() => service.plural('listControls.optionCount', { count: -1 })).toThrow(RangeError);
    expect(() => service.plural('listControls.optionCount', { count: 1.5 })).toThrow(RangeError);
    expect(service.language()).toBe('en');
  });

  it('returns parameters as literal text rather than HTML', () => {
    const service = TestBed.inject(I18nService);
    service.setLanguage('en');
    const client = '<img src=x onerror="alert(1)">';
    expect(service.tf('backOffice.clients.accessReady', { client })).toBe(
      `Sign-in identifier created for ${client}`,
    );
  });

  it('renders additional plural parameters as Angular text, not HTML elements', async () => {
    const fixture = TestBed.createComponent(PluralTextExample);
    fixture.componentInstance.i18n.setLanguage('en');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('p')?.textContent).toBe(
      `Create the token “${fixture.componentInstance.name}” with 2 permissions?`,
    );
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('script')).toBeNull();
  });
});
