import { convertToParamMap } from '@angular/router';
import { compareEmailRows, emailQuery, emailView } from './email-workspace';

describe('email list query', () => {
  it('limits searches and normalizes unsupported query values', () => {
    expect(
      emailQuery(convertToParamMap({ q: 'x'.repeat(121), state: 'deleted', sort: 'bad' })),
    ).toEqual({ q: 'x'.repeat(120), state: 'all', sort: 'date-desc' });
    expect(emailView('drafts')).toBe('drafts');
    expect(emailView('https://other.test')).toBe('messages');
  });
  it('sorts by localized subject or UTC timestamp', () => {
    expect(
      compareEmailRows(
        ['Écrit', '2026-01-01T00:00:00.000Z'],
        ['Zèbre', '2026-01-02T00:00:00.000Z'],
        'subject-asc',
        'fr',
      ),
    ).toBeLessThan(0);
    expect(
      compareEmailRows(
        ['Écrit', '2026-01-01T00:00:00.000Z'],
        ['Zèbre', '2026-01-02T00:00:00.000Z'],
        'date-desc',
        'fr',
      ),
    ).toBeGreaterThan(0);
  });
});
