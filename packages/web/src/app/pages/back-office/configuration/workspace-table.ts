import { computed, inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { Option, Schema } from 'effect';
import { type FuseResult, type IFuseOptions } from 'fuse.js';
import { I18nService, type Language, type TranslationKey } from '@app/i18n.service';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { type SortDirection } from '@shared/table-sort/table-sort';

export type WorkspaceTableColumn<Item> =
  | {
      readonly kind: 'text';
      readonly key: string;
      readonly value: (item: Item, language: Language) => string | null;
    }
  | {
      readonly kind: 'number';
      readonly key: string;
      readonly value: (item: Item) => number | null;
    };

export interface WorkspaceTableParams {
  [parameter: string]: string;
}

export interface WorkspaceTableOptions<Item> {
  readonly columns: readonly WorkspaceTableColumn<Item>[];
  readonly defaultSort: string;
  readonly id: (item: Item) => string;
  readonly searchKeys: IFuseOptions<Item>['keys'];
  readonly parameters?: { readonly q: string; readonly sort: string; readonly filter: string };
  readonly filters?: readonly { readonly value: string; readonly label: TranslationKey }[];
  readonly matchesFilter?: (item: Item, filter: string) => boolean;
}

const defaultParameters = { q: 'q', sort: 'sort', filter: 'filter' };
const SearchQuery = Schema.String.check(Schema.isMaxLength(120));

export const workspaceTableQuery = <Item>(
  params: ParamMap,
  options: WorkspaceTableOptions<Item>,
) => {
  const keys = options.parameters ?? defaultParameters;
  const Sort = Schema.Literals(options.columns.flatMap(({ key }) => [`${key}Asc`, `${key}Desc`]));
  const Filter = Schema.Literals(['all', ...(options.filters ?? []).map(({ value }) => value)]);
  const read = <Value>(
    key: string,
    schema: Schema.ConstraintDecoder<Value>,
    defaultValue: Value,
  ): Value =>
    params.getAll(key).length !== 1
      ? defaultValue
      : Option.getOrElse(Schema.decodeUnknownOption(schema)(params.get(key)), () => defaultValue);
  return {
    q: read(keys.q, SearchQuery, ''),
    sort: read(keys.sort, Sort, options.defaultSort),
    filter: read(keys.filter, Filter, 'all'),
  };
};

export const workspaceTableParams = <Item>(
  query: { readonly q: string; readonly sort: string; readonly filter: string },
  options: WorkspaceTableOptions<Item>,
): WorkspaceTableParams => {
  const keys = options.parameters ?? defaultParameters;
  const params: WorkspaceTableParams = {};
  if (query.q !== '') params[keys.q] = query.q;
  if (query.sort !== options.defaultSort) params[keys.sort] = query.sort;
  if (query.filter !== 'all') params[keys.filter] = query.filter;
  return params;
};

export const sortWorkspaceRows = <Item>(
  results: readonly FuseResult<Item>[],
  options: WorkspaceTableOptions<Item>,
  sort: string,
  language: Language,
): readonly FuseResult<Item>[] => {
  const column = options.columns.find(({ key }) => sort === `${key}Asc` || sort === `${key}Desc`);
  if (column === undefined) throw new Error('workspace.invalid_sort');
  const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
  const direction = sort.endsWith('Desc') ? -1 : 1;
  const compareRows =
    column.kind === 'number'
      ? (left: Item, right: Item) => {
          const a = column.value(left);
          const b = column.value(right);
          if (a === null) return b === null ? 0 : 1;
          if (b === null) return -1;
          return direction * (a - b);
        }
      : (left: Item, right: Item) => {
          const a = column.value(left, language);
          const b = column.value(right, language);
          if (a === null) return b === null ? 0 : 1;
          if (b === null) return -1;
          return direction * collator.compare(a, b);
        };
  return results.toSorted((left, right) => {
    const comparison = compareRows(left.item, right.item);
    const leftId = options.id(left.item);
    const rightId = options.id(right.item);
    return comparison || (leftId < rightId ? -1 : leftId > rightId ? 1 : 0);
  });
};

export const workspaceMatch = <Item>(result: FuseResult<Item>, key: string, index?: number) =>
  result.matches?.find(
    (match) => match.key === key && (index === undefined || match.refIndex === index),
  )?.indices ?? [];

export const createWorkspaceTable = <Item>(
  items: Signal<readonly Item[]>,
  options: WorkspaceTableOptions<Item>,
) => {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const i18n = inject(I18nService);
  const params = toSignal(route.queryParamMap, { requireSync: true });
  const query = computed(() => workspaceTableQuery(params(), options));
  const filtered = computed(() =>
    items().filter(
      (item) => query().filter === 'all' || options.matchesFilter?.(item, query().filter) === true,
    ),
  );
  const matches = createFuzzySearch(
    filtered,
    computed(() => query().q),
    {
      keys: options.searchKeys,
      includeMatches: true,
      ignoreDiacritics: true,
      ignoreLocation: true,
      threshold: 0.35,
    },
  );
  const results = computed(() =>
    sortWorkspaceRows(matches(), options, query().sort, i18n.language()),
  );
  const filterOptions = computed(() => [
    { value: 'all', label: i18n.t('configurationWorkspace.allRows') },
    ...(options.filters ?? []).map(({ value, label }) => ({ value, label: i18n.t(label) })),
  ]);
  const navigate = (patch: Partial<ReturnType<typeof query>>, replaceUrl = false) => {
    const keys = options.parameters ?? defaultParameters;
    void router.navigate([], {
      relativeTo: route,
      queryParams: {
        [keys.q]: null,
        [keys.sort]: null,
        [keys.filter]: null,
        ...workspaceTableParams({ ...query(), ...patch }, options),
      },
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  };
  return {
    query,
    results,
    rows: computed(() => results().map(({ item }) => item)),
    params: computed(() => workspaceTableParams(query(), options)),
    filterOptions,
    filterSummary: computed(
      () => filterOptions().find(({ value }) => value === query().filter)?.label ?? '',
    ),
    match: workspaceMatch,
    direction: (column: string): SortDirection =>
      query().sort === `${column}Asc`
        ? 'ascending'
        : query().sort === `${column}Desc`
          ? 'descending'
          : 'none',
    sort: (column: string) => {
      if (options.columns.some(({ key }) => key === column))
        navigate({ sort: `${column}${query().sort === `${column}Asc` ? 'Desc' : 'Asc'}` });
    },
    search: (q: string) => navigate({ q: q.slice(0, 120) }, true),
    filter: (value: string) => {
      if (value === 'all' || options.filters?.some((option) => option.value === value))
        navigate({ filter: value });
    },
  };
};
