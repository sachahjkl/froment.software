import { formatLocalizedDate, LocalizedDatePipe } from './localized-date-pipe';

describe('LocalizedDatePipe', () => {
  it('keeps an ISO date on the same calendar day in every time zone', () => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Los_Angeles',
    };

    expect(formatLocalizedDate('2026-05-28', 'en', options)).toBe('05/28/2026');
  });

  it('rejects an invalid ISO calendar date', () => {
    expect(() => formatLocalizedDate('2026-02-30', 'fr')).toThrow(RangeError);
  });

  it('applies time zones to timestamps but never to calendar dates', () => {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: 'medium',
      timeZone: 'America/Los_Angeles',
    };
    expect(formatLocalizedDate('2026-01-01', 'en-US', options)).toBe('Jan 1, 2026');
    expect(formatLocalizedDate('2026-01-01T00:00:00Z', 'en-US', options)).toBe('Dec 31, 2025');
    expect(formatLocalizedDate('2024-02-29', 'en-US', options)).toBe('Feb 29, 2024');
  });

  it('uses the explicit locale argument', () => {
    const pipe = new LocalizedDatePipe();
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'long' };

    expect(pipe.transform('2026-05-28', 'fr', options)).not.toBe(
      pipe.transform('2026-05-28', 'en', options),
    );
  });
});
