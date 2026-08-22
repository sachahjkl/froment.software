import type Sqlite from 'better-sqlite3';
import { DateTime, Option, Schema } from 'effect';

export type BusinessReferenceKind = 'quote' | 'order' | 'invoice';

const prefixes = {
  quote: 'DE',
  order: 'CO',
  invoice: 'FA',
} satisfies Record<BusinessReferenceKind, string>;

export const businessYear = (instant: number, timeZone: DateTime.TimeZone.Named): number =>
  DateTime.toParts(DateTime.makeUnsafe(instant).pipe(DateTime.setZone(timeZone))).year;

export const allocateBusinessReference = (
  sqlite: Sqlite.Database,
  kind: BusinessReferenceKind,
  year: number,
): string => {
  sqlite
    .prepare(
      `insert into business_reference_counters (kind, year, next_value)
       values (?, ?, 1) on conflict (kind, year) do nothing`,
    )
    .run(kind, year);
  const value = Schema.decodeUnknownOption(Schema.Int)(
    sqlite
      .prepare(
        `update business_reference_counters set next_value = next_value + 1
       where kind = ? and year = ? and next_value <= 999999
       returning next_value - 1`,
      )
      .pluck()
      .get(kind, year),
  );
  if (Option.isNone(value)) throw new RangeError('business.reference.sequence_exhausted');
  return `${prefixes[kind]}-${String(year).padStart(4, '0')}-${String(value.value).padStart(6, '0')}`;
};
