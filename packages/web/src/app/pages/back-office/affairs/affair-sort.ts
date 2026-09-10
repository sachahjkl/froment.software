import { type QuoteSummaryValue } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type SortDirection } from '@shared/table-sort/table-sort';
import { nextTableSort } from '@shared/table-sort/sort-state';
import { type AffairSort } from './affair-filters';

export const affairColumns = [
  { key: 'reference', label: 'backOffice.affairs.reference' },
  { key: 'title', label: 'backOffice.quote.title' },
  { key: 'client', label: 'backOffice.affairs.client' },
  { key: 'stage', label: 'backOffice.affairs.progress' },
  { key: 'amount', label: 'commercial.quoteAmount' },
  { key: 'updated', label: 'commercial.updated' },
] as const satisfies readonly { readonly key: string; readonly label: TranslationKey }[];
export type AffairColumn = (typeof affairColumns)[number]['key'];

interface AffairSortRow {
  readonly quote: QuoteSummaryValue;
  readonly stageLabel: string;
}

export function affairSortDirection(sort: AffairSort, column: AffairColumn): SortDirection {
  if (sort === `${column}-asc`) return 'ascending';
  return sort === `${column}-desc` ? 'descending' : 'none';
}

export function nextAffairSort(sort: AffairSort, column: AffairColumn): AffairSort {
  return nextTableSort(sort, `${column}-asc`, `${column}-desc`);
}

export function compareAffairs(
  left: AffairSortRow,
  right: AffairSortRow,
  sort: AffairSort,
  collator: Intl.Collator,
): number {
  const order = sort === 'none' ? 'updated-desc' : sort;
  let comparison: number;
  switch (order) {
    case 'reference-asc':
    case 'reference-desc':
      comparison = collator.compare(left.quote.reference, right.quote.reference);
      break;
    case 'title-asc':
    case 'title-desc':
      comparison = collator.compare(left.quote.title, right.quote.title);
      break;
    case 'client-asc':
    case 'client-desc':
      comparison = collator.compare(left.quote.clientDisplayName, right.quote.clientDisplayName);
      break;
    case 'stage-asc':
    case 'stage-desc':
      comparison = collator.compare(left.stageLabel, right.stageLabel);
      break;
    case 'amount-asc':
    case 'amount-desc':
      comparison = left.quote.totalCents - right.quote.totalCents;
      break;
    case 'updated-asc':
    case 'updated-desc':
      comparison = Date.parse(left.quote.updatedAt) - Date.parse(right.quote.updatedAt);
      break;
  }
  const byId = left.quote.id < right.quote.id ? -1 : left.quote.id > right.quote.id ? 1 : 0;
  return (order.endsWith('-desc') ? -comparison : comparison) || byId;
}
