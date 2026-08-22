import { DateTime, Option, Schema } from 'effect';

export const IsoUtc = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
  Schema.makeFilter(
    (value) => Option.exists(DateTime.make(value), (date) => DateTime.formatIso(date) === value),
    { message: 'temporal.utc.invalid' },
  ),
);

export const CalendarDateText = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/));

export const CalendarDate = CalendarDateText.check(
  Schema.makeFilter(
    (value) =>
      Option.exists(DateTime.make(value), (date) => DateTime.formatIsoDateUtc(date) === value),
    { message: 'invoice.invalid_dates' },
  ),
);
