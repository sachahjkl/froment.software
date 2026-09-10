import { type ParamMap } from '@angular/router';
import { CatalogItemCreateRequest } from '@froment/contracts';
import { Option, Schema } from 'effect';

const CatalogSort = Schema.Literals([
  'none',
  'description-asc',
  'description-desc',
  'quantity-asc',
  'quantity-desc',
  'price-asc',
  'price-desc',
  'tax-asc',
  'tax-desc',
  'status-asc',
  'status-desc',
]);
export type CatalogSortColumn = 'description' | 'quantity' | 'price' | 'tax' | 'status';
const CatalogTaxRate = Schema.String.check(Schema.isPattern(/^\d+$/)).pipe(
  Schema.decodeTo(Schema.NumberFromString),
  Schema.decodeTo(CatalogItemCreateRequest.fields.vatRateBasisPoints),
);
const CatalogView = Schema.Literals(['active', 'archived', 'all']);
export type CatalogView = typeof CatalogView.Type;

export const catalogTaxRate = (value: string | null): number | null =>
  Option.getOrNull(Schema.decodeUnknownOption(CatalogTaxRate)(value));

export const catalogListQuery = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 120),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(CatalogSort)(params.get('sort')),
    () => 'none' as const,
  ),
  tax: catalogTaxRate(params.get('tax')),
});

export const catalogFilterQuery = (query: ReturnType<typeof catalogListQuery>) => ({
  ...query,
  sort: query.sort === 'none' ? undefined : query.sort,
});

export const catalogView = (value: string | null | undefined): CatalogView =>
  Option.getOrElse(Schema.decodeUnknownOption(CatalogView)(value), () => 'active' as const);

export const catalogReturnView = (params: ParamMap): CatalogView => catalogView(params.get('view'));
