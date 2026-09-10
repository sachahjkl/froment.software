import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { type CatalogItemListValue } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { CatalogApi } from '@backoffice/catalog-api';
import { formatFixedDecimal } from '@backoffice/quote-input';
import { I18nService } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { EmptyState } from '@shared/empty-state/empty-state';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { Icon } from '@shared/icon/icon';
import { ListSearch } from '@shared/list-search/list-search';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TableExport } from '@shared/table-export/table-export';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { nextTableSort } from '@shared/table-sort/sort-state';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import {
  catalogFilterQuery,
  catalogListQuery,
  catalogTaxRate,
  catalogView,
  type CatalogSortColumn,
  type CatalogView,
} from './catalog-list-query';

@Component({
  host: { class: 'page-container' },
  imports: [
    EntityIcon,
    Badge,
    Button,
    DataTable,
    EmptyState,
    FilterChip,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    FormField,
    Icon,
    ListSearch,
    ListToolbar,
    ListWorkspace,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    SearchHighlight,
    TableExport,
    TableSort,
    TabLayout,
    TabPanel,
    Tabs,
  ],
  providers: [SearchHighlightRegistry],
  selector: 'app-catalog',
  styleUrl: './catalog.scss',
  templateUrl: './catalog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly items = signal<CatalogItemListValue>([]);
  protected readonly query = signal(catalogListQuery(this.route.snapshot.queryParamMap));
  private readonly filterModel = signal({
    search: this.query().q,
    tax: this.query().tax?.toString() ?? '',
  });
  protected readonly filters = form(this.filterModel);
  protected readonly filtered = computed(() => this.query().q !== '' || this.query().tax !== null);
  protected readonly taxRates = computed(() => {
    const { tax } = this.query();
    return [
      ...new Set([
        ...this.items().map((item) => item.vatRateBasisPoints),
        ...(tax === null ? [] : [tax]),
      ]),
    ].sort((left, right) => left - right);
  });
  protected readonly exportColumns = computed(() => [
    this.i18n.t('catalog.description'),
    this.i18n.t('catalog.quantity'),
    this.i18n.t('catalogWorkspace.exportPrice'),
    this.i18n.t('catalog.tax'),
    this.i18n.t('catalogWorkspace.status'),
  ]);
  protected readonly taxChoices = computed(() => [
    { value: '', label: this.i18n.t('catalogWorkspace.allTaxRates') },
    ...this.taxRates().map((rate) => ({
      value: String(rate),
      label: `${this.decimal(rate, 2)} %`,
    })),
  ]);
  protected readonly saved =
    this.router.currentNavigation()?.extras.state?.['catalogSaved'] === true;
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['active', 'archived', 'all'] as const).map((view) => ({
      path: view,
      id: `catalog-${view}-tab`,
      label: this.i18n.t(`catalogWorkspace.${view}`),
    })),
  );
  private readonly searchResults = createFuzzySearch(
    this.items,
    computed(() => this.filters.search().value()),
    {
      keys: ['description'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  private readonly results = computed(() => {
    const sort = this.query().sort === 'none' ? 'description-asc' : this.query().sort;
    const direction = sort.endsWith('desc') ? -1 : 1;
    const collator = new Intl.Collator(this.i18n.language(), {
      numeric: true,
      sensitivity: 'base',
    });
    return this.searchResults()
      .toSorted((left, right) => {
        let comparison: number;
        if (sort.startsWith('quantity')) {
          comparison = left.item.quantityMilli - right.item.quantityMilli;
        } else if (sort.startsWith('price')) {
          comparison = left.item.unitPriceCents - right.item.unitPriceCents;
        } else if (sort.startsWith('tax')) {
          comparison = left.item.vatRateBasisPoints - right.item.vatRateBasisPoints;
        } else if (sort.startsWith('status')) {
          comparison = Number(left.item.archived) - Number(right.item.archived);
        } else {
          comparison = collator.compare(left.item.description, right.item.description);
        }
        return direction * comparison || left.item.id.localeCompare(right.item.id);
      })
      .map((result) => ({
        item: result.item,
        matches: result.matches?.find((match) => match.key === 'description')?.indices ?? [],
      }));
  });
  private loadGeneration = 0;

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = catalogListQuery(params);
        this.query.set(query);
        this.filterModel.set({ search: query.q, tax: query.tax?.toString() ?? '' });
      });
      void this.load();
    });
  }

  protected visibleItems(view: CatalogView) {
    const { tax } = this.query();
    return this.results().filter(
      ({ item }) =>
        (view === 'all' || item.archived === (view === 'archived')) &&
        (tax === null || item.vatRateBasisPoints === tax),
    );
  }

  protected iconVariant(item: CatalogItemListValue[number]): EntityIconVariant {
    if (item.archived) return 'warning';
    return 'success';
  }

  protected exportRows(view: CatalogView) {
    if (this.state() !== 'ready') return [];
    return this.visibleItems(view).map(({ item }) => [
      item.description,
      formatFixedDecimal(item.quantityMilli, 3),
      formatFixedDecimal(item.unitPriceCents, 2),
      formatFixedDecimal(item.vatRateBasisPoints, 2),
      this.i18n.t(item.archived ? 'catalog.archived' : 'catalogWorkspace.available'),
    ]);
  }

  protected editorQuery(view: CatalogView) {
    return { ...catalogFilterQuery(this.query()), view };
  }

  protected createQuery() {
    return this.editorQuery(catalogView(this.route.firstChild?.snapshot.url[0]?.path));
  }

  protected setSearch(value: string): void {
    const q = value.slice(0, 120);
    this.filterModel.update((model) => ({ ...model, search: q }));
    this.query.update((query) => ({ ...query, q }));
    this.updateQuery();
  }

  protected clearSearch(): void {
    this.setSearch('');
    this.filters.search().focusBoundControl();
  }

  protected setTax(value: string): void {
    const tax = catalogTaxRate(value);
    this.filterModel.update((model) => ({ ...model, tax: tax?.toString() ?? '' }));
    this.query.update((query) => ({ ...query, tax }));
    this.updateQuery();
  }

  protected clearTax(): void {
    this.setTax('');
    this.filters.search().focusBoundControl();
  }

  protected resetFilters(): void {
    this.filterModel.set({ search: '', tax: '' });
    this.query.update((query) => ({ ...query, q: '', tax: null }));
    this.updateQuery();
    this.filters.search().focusBoundControl();
  }

  protected sortDirection(column: CatalogSortColumn): SortDirection {
    const { sort } = this.query();
    return sort === `${column}-asc`
      ? 'ascending'
      : sort === `${column}-desc`
        ? 'descending'
        : 'none';
  }

  protected sortBy(column: CatalogSortColumn): void {
    const sort = nextTableSort(this.query().sort, `${column}-asc`, `${column}-desc`);
    this.query.update((query) => ({ ...query, sort }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: sort === 'none' ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private updateQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: catalogFilterQuery(this.query()),
      replaceUrl: true,
    });
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    try {
      const items = await this.api.list();
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      this.items.set(items);
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration) this.state.set('error');
    }
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected decimal(value: number, places: number): string {
    return formatFixedDecimal(value, places, this.i18n.language() === 'fr' ? ',' : '.');
  }
}
