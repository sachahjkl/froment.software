import { type ParamMap } from '@angular/router';
import { Option, Schema } from 'effect';
import { quoteIdentifier } from '../quote-detail/quote-values';

export const affairStages = [
  'draft',
  'sent',
  'rejected',
  'expired',
  'archived',
  'cancelled',
  'ordered',
  'invoiceDraft',
  'issued',
  'paid',
  'void',
] as const;
export type AffairStage = (typeof affairStages)[number];
export type AffairView = 'attention' | 'active' | 'completed' | 'all';

const affairSortSchema = Schema.Literals([
  'none',
  'reference-asc',
  'reference-desc',
  'title-asc',
  'title-desc',
  'client-asc',
  'client-desc',
  'stage-asc',
  'stage-desc',
  'amount-asc',
  'amount-desc',
  'updated-asc',
  'updated-desc',
]);
export type AffairSort = typeof affairSortSchema.Type;

export function affairSort(params: ParamMap): AffairSort {
  return Option.getOrElse(
    Schema.decodeUnknownOption(affairSortSchema)(params.get('sort')),
    () => 'none' as const,
  );
}

export function affairFilters(params: ParamMap) {
  return {
    q: (params.get('q') ?? '').slice(0, 120),
    stage: Option.getOrElse(
      Schema.decodeUnknownOption(Schema.Literals(affairStages))(params.get('stage')),
      () => '' as const,
    ),
    client: quoteIdentifier(params.get('client')) ?? '',
  };
}
export function affairView(params: ParamMap): AffairView {
  return Option.getOrElse(
    Schema.decodeUnknownOption(Schema.Literals(['attention', 'active', 'completed', 'all']))(
      params.get('view'),
    ),
    () => 'attention',
  );
}

export function affairContext(params: ParamMap) {
  const filters = affairFilters(params);
  const sort = affairSort(params);
  return {
    q: filters.q || undefined,
    stage: filters.stage || undefined,
    client: filters.client || undefined,
    view: params.has('view') ? affairView(params) : undefined,
    sort: sort === 'none' ? undefined : sort,
  };
}
