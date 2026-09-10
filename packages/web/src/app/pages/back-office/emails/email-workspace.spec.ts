import { convertToParamMap } from '@angular/router';
import {
  compareEmailRows,
  emailDate,
  emailDateMatches,
  emailQuery,
  emailView,
} from './email-workspace';

describe('email list query', () => {
  it('limits searches and normalizes unsupported query values', () => {
    expect(
      emailQuery(convertToParamMap({ q: 'x'.repeat(121), state: 'deleted', sort: 'bad' })),
    ).toEqual({ q: 'x'.repeat(120), state: 'all', sort: 'date-desc' });
    expect(emailView('drafts')).toBe('drafts');
    expect(emailView('https://other.test')).toBe('messages');
  });
  it('filters the displayed browser calendar date and rejects nonexistent dates', () => {
    expect(emailDate('2026-02-30')).toBeUndefined();
    expect(emailDate('2026-09-10')).toBe('2026-09-10');
    const query = emailQuery(convertToParamMap({ from: '2026-09-10', to: '2026-09-10' }));
    expect(emailDateMatches(new Date(2026, 8, 10, 12).toISOString(), query)).toBe(true);
    expect(emailDateMatches(new Date(2026, 8, 11, 12).toISOString(), query)).toBe(false);
    expect(
      emailDateMatches(new Date(2026, 8, 10, 12).toISOString(), { ...query, from: '2026-09-11' }),
    ).toBe(false);
  });
  it('sorts by localized subject or UTC timestamp', () => {
    expect(
      compareEmailRows(
        { id: 'a', subject: 'Écrit', date: '2026-01-01T00:00:00.000Z' },
        { id: 'b', subject: 'Zèbre', date: '2026-01-02T00:00:00.000Z' },
        'subject-asc',
        'fr',
      ),
    ).toBeLessThan(0);
    expect(
      compareEmailRows(
        { id: 'a', subject: 'Écrit', date: '2026-01-01T00:00:00.000Z' },
        { id: 'b', subject: 'Zèbre', date: '2026-01-02T00:00:00.000Z' },
        'date-desc',
        'fr',
      ),
    ).toBeGreaterThan(0);
  });
  it('sorts recipients and states and keeps stable identifiers for equal values', () => {
    const left = {
      id: 'a',
      subject: 'Invoice 2',
      date: '2026-01-01T00:00:00Z',
      recipient: 'a@example.test',
      state: 'En attente',
    };
    const right = {
      ...left,
      id: 'b',
      subject: 'Invoice 10',
      recipient: 'z@example.test',
      state: 'Simulé',
    };
    expect(compareEmailRows(left, right, 'recipient-asc', 'fr')).toBeLessThan(0);
    expect(compareEmailRows(left, right, 'recipient-desc', 'fr')).toBeGreaterThan(0);
    expect(compareEmailRows(left, right, 'state-asc', 'fr')).toBeLessThan(0);
    expect(compareEmailRows(left, right, 'subject-asc', 'en')).toBeLessThan(0);
    expect(compareEmailRows(left, right, 'date-desc', 'fr')).toBeLessThan(0);
    expect(
      compareEmailRows({ ...left, date: '2026-01-01T02:00:00+03:00' }, right, 'date-asc', 'fr'),
    ).toBeLessThan(0);
  });
});
