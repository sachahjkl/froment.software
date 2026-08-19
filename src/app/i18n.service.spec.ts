import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

const languageStorageKey = 'froment.software.language';

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
});
