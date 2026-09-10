import { type ParamMap } from '@angular/router';
import { Option, Schema } from 'effect';

export const PortalFilterKind = Schema.Literals(['all', 'quote', 'order', 'invoice']);
export const PortalFilterStatus = Schema.Literals(['all', 'open', 'completed']);
const PortalSort = Schema.Literals([
  'none',
  'reference-asc',
  'reference-desc',
  'kind-asc',
  'kind-desc',
  'status-asc',
  'status-desc',
  'date-asc',
  'date-desc',
  'amount-asc',
  'amount-desc',
]);
export type PortalSortColumn = 'reference' | 'kind' | 'status' | 'date' | 'amount';

export const portalFilters = (params: ParamMap) => ({
  search: (params.get('q') ?? '').slice(0, 120),
  kind: Option.getOrElse(
    Schema.decodeUnknownOption(PortalFilterKind)(params.get('kind')),
    () => 'all' as const,
  ),
  status: Option.getOrElse(
    Schema.decodeUnknownOption(PortalFilterStatus)(params.get('status')),
    () => 'all' as const,
  ),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(PortalSort)(params.get('sort')),
    () => 'none' as const,
  ),
});

export const portalFilterQuery = ({
  search,
  kind,
  status,
  sort,
}: ReturnType<typeof portalFilters>) => ({
  q: search || undefined,
  kind: kind === 'all' ? undefined : kind,
  status: status === 'all' ? undefined : status,
  sort: sort === 'none' ? undefined : sort,
});
