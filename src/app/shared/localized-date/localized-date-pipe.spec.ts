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

  it('uses the explicit locale argument', () => {
    const pipe = new LocalizedDatePipe();
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'long' };

    expect(pipe.transform('2026-05-28', 'fr', options)).not.toBe(
      pipe.transform('2026-05-28', 'en', options),
    );
  });
});
