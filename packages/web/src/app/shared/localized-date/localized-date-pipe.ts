import { Pipe, PipeTransform } from '@angular/core';

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatLocalizedDate(
  value: string | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'short' },
): string {
  if (!(value instanceof Date)) {
    const match = isoDatePattern.exec(value);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(0);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCFullYear(year, month - 1, day);
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new RangeError('invalid_iso_date');
      }

      return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(date);
    }
  }

  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

@Pipe({ name: 'localizedDate' })
export class LocalizedDatePipe implements PipeTransform {
  transform(value: string | Date, locale: string, options?: Intl.DateTimeFormatOptions): string {
    return formatLocalizedDate(value, locale, options);
  }
}
