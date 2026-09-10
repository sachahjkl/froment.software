import { type ParamMap } from '@angular/router';
import { CalendarDate, type ClientAccessValue } from '@froment/contracts';
import { Option, Schema } from 'effect';

export const ClientAccessPeriod = Schema.Struct({
  from: Schema.optional(CalendarDate),
  to: Schema.optional(CalendarDate),
}).check(Schema.makeFilter(({ from, to }) => from === undefined || to === undefined || from <= to));
export type ClientAccessPeriod = typeof ClientAccessPeriod.Type;

export function clientAccessPeriod(params: ParamMap): ClientAccessPeriod {
  const read = (key: string): string | undefined =>
    params.getAll(key).length === 1 ? (params.get(key) ?? undefined) : undefined;
  return Option.getOrElse(
    Schema.decodeUnknownOption(ClientAccessPeriod)({
      from: read('clientAccessFrom'),
      to: read('clientAccessTo'),
    }),
    () => ({}),
  );
}

export function clientAccessPeriodParams(period: ClientAccessPeriod) {
  return {
    clientAccessFrom: period.from ?? null,
    clientAccessTo: period.to ?? null,
  };
}

export function clientAccessMatchesPeriod(
  access: ClientAccessValue,
  period: ClientAccessPeriod,
): boolean {
  if (period.from === undefined && period.to === undefined) return true;
  const date = new Date(access.createdAt);
  const day = `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return (
    (period.from === undefined || day >= period.from) &&
    (period.to === undefined || day <= period.to)
  );
}
