import type { TranslationKey } from '@app/i18n.service';
import type { SortDirection } from '@shared/table-sort/table-sort';

export type BankTableColumn<Row> = {
  readonly key: string;
  readonly label: TranslationKey;
} & (
  | { readonly kind: 'text'; readonly value: (row: Row) => string }
  | { readonly kind: 'date'; readonly value: (row: Row) => string | null }
  | { readonly kind: 'number' | 'rank'; readonly value: (row: Row) => number }
);

export function bankTableSort<Row>(
  value: string | null,
  columns: readonly BankTableColumn<Row>[],
  defaultSort = 'date-desc',
): string {
  for (const { key } of columns) {
    if (value === `${key}-asc` || value === `${key}-desc`) return value;
  }
  return defaultSort;
}

export function bankSortDirection(sort: string, column: string): SortDirection {
  return sort === `${column}-asc` ? 'ascending' : sort === `${column}-desc` ? 'descending' : 'none';
}

export function nextBankSort(sort: string, column: string): string {
  return `${column}-${bankSortDirection(sort, column) === 'ascending' ? 'desc' : 'asc'}`;
}

const compareIdentity = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export function compareBankRows<Row>(
  sort: string,
  columns: readonly BankTableColumn<Row>[],
  language: string,
  identity: (row: Row) => string,
): (left: Row, right: Row) => number {
  const column = columns.find(({ key }) => bankSortDirection(sort, key) !== 'none');
  if (!column) throw new Error('bank.sort_invalid');
  const direction = sort.endsWith('-desc') ? -1 : 1;
  const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
  return (left, right) => {
    let comparison: number;
    switch (column.kind) {
      case 'text':
        comparison = collator.compare(column.value(left), column.value(right));
        break;
      case 'date': {
        const leftValue = column.value(left);
        const rightValue = column.value(right);
        // Les dates absentes restent après les dates connues dans les deux sens.
        if (leftValue === null && rightValue !== null) return 1;
        if (leftValue !== null && rightValue === null) return -1;
        comparison =
          leftValue === null || rightValue === null
            ? 0
            : Date.parse(leftValue) - Date.parse(rightValue);
        break;
      }
      case 'number':
      case 'rank':
        comparison = column.value(left) - column.value(right);
        break;
    }
    return direction * comparison || compareIdentity(identity(left), identity(right));
  };
}
