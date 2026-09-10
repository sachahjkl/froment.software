import { type ParamMap } from '@angular/router';
import { Option, Schema } from 'effect';

const CatalogSort = Schema.Literals([
  'description-asc',
  'description-desc',
  'price-asc',
  'price-desc',
]);
const CatalogView = Schema.Literals(['active', 'archived', 'all']);
export type CatalogView = typeof CatalogView.Type;

export const catalogListQuery = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 120),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(CatalogSort)(params.get('sort')),
    () => 'description-asc' as const,
  ),
});

export const catalogView = (value: string | null | undefined): CatalogView =>
  Option.getOrElse(Schema.decodeUnknownOption(CatalogView)(value), () => 'active' as const);

export const catalogReturnView = (params: ParamMap): CatalogView => catalogView(params.get('view'));
