import { type ParamMap } from '@angular/router';
import { Option, Schema } from 'effect';

const ClientSort = Schema.Literals([
  'name-asc',
  'name-desc',
  'country-asc',
  'country-desc',
  'date-asc',
  'date-desc',
]);
const ClientView = Schema.Literals(['active', 'archived', 'all']);
export type ClientView = typeof ClientView.Type;
export type ClientSortColumn = 'name' | 'country' | 'date';
const ContactFilter = Schema.Literals(['all', 'incomplete']);

export const clientView = (value: string | null): ClientView =>
  Option.getOrElse(Schema.decodeUnknownOption(ClientView)(value), () => 'active' as const);

export const clientFilters = (params: ParamMap) => ({
  search: (params.get('q') ?? '').slice(0, 120),
  country: (params.get('country') ?? '').slice(0, 120),
  contact: Option.getOrElse(
    Schema.decodeUnknownOption(ContactFilter)(params.get('contact')),
    () => 'all' as const,
  ),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(ClientSort)(params.get('sort')),
    () => 'name-asc' as const,
  ),
});

export const clientFilterQuery = ({
  search,
  country,
  contact,
  sort,
}: ReturnType<typeof clientFilters>) => ({
  q: search || undefined,
  country: country || undefined,
  contact: contact === 'all' ? undefined : contact,
  sort: sort === 'name-asc' ? undefined : sort,
});
