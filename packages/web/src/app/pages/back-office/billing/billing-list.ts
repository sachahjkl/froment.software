import { type ParamMap } from '@angular/router';
import { type FuseResult, type FuseResultMatch } from 'fuse.js';
import { type SortDirection } from '@shared/table-sort/table-sort';

export type BillingSort<Column extends string> = `${Column}-${'asc' | 'desc'}`;

export function readBillingSort<Column extends string>(
  params: ParamMap,
  columns: readonly Column[],
  defaultSort: BillingSort<Column>,
): BillingSort<Column> {
  const value = params.get('sort');
  for (const column of columns) {
    if (value === `${column}-asc`) return `${column}-asc`;
    if (value === `${column}-desc`) return `${column}-desc`;
  }
  return defaultSort;
}

export function sortDirection(sort: string, column: string): SortDirection {
  return sort === `${column}-asc` ? 'ascending' : sort === `${column}-desc` ? 'descending' : 'none';
}

export function nextBillingSort<Column extends string>(
  sort: string,
  column: Column,
): BillingSort<Column> {
  return sort === `${column}-asc` ? `${column}-desc` : `${column}-asc`;
}

export function matchIndices(
  result: Pick<FuseResult<unknown>, 'matches'>,
  key: string,
): FuseResultMatch['indices'] {
  return result.matches?.find((match) => match.key === key)?.indices ?? [];
}
