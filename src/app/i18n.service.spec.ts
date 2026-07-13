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

  it('keeps an ISO date-only value on its calendar day in America/Los_Angeles', () => {
    const service = TestBed.inject(I18nService);
    service.setLanguage('en');

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Los_Angeles',
      })
        .formatToParts(new Date('2026-05-28T12:00:00-07:00'))
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    const formatted = service.formatDate('2026-05-28', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Los_Angeles',
    });

    expect(formatted).toContain(parts['year']);
    expect(formatted).toContain(parts['month']);
    expect(formatted).toContain(parts['day']);
  });
});
