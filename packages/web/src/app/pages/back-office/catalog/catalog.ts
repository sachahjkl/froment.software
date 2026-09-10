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
import { EmptyState } from '@shared/empty-state/empty-state';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { Icon } from '@shared/icon/icon';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { catalogListQuery, catalogView, type CatalogView } from './catalog-list-query';

@Component({
  host: { class: 'page-container' },
  imports: [
    Badge,
    Button,
    DataTable,
    EmptyState,
    FilterChip,
    FormField,
    Icon,
    ListToolbar,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    SearchHighlight,
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
  private readonly searchModel = signal({ search: this.query().q });
  protected readonly filters = form(this.searchModel);
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
    const { sort } = this.query();
    const direction = sort.endsWith('desc') ? -1 : 1;
    const collator = new Intl.Collator(this.i18n.language(), {
      numeric: true,
      sensitivity: 'base',
    });
    return this.searchResults()
      .toSorted((left, right) => {
        const comparison = sort.startsWith('price')
          ? left.item.unitPriceCents - right.item.unitPriceCents
          : collator.compare(left.item.description, right.item.description);
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
        this.searchModel.set({ search: query.q });
      });
      void this.load();
    });
  }

  protected visibleItems(view: CatalogView) {
    return this.results().filter(
      ({ item }) => view === 'all' || item.archived === (view === 'archived'),
    );
  }

  protected editorQuery(view: CatalogView) {
    return { ...this.query(), view };
  }

  protected createQuery() {
    return this.editorQuery(catalogView(this.route.firstChild?.snapshot.url[0]?.path));
  }

  protected setSearch(value: string): void {
    const q = value.slice(0, 120);
    this.searchModel.set({ search: q });
    this.query.update((query) => ({ ...query, q }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.query(),
      replaceUrl: true,
    });
  }

  protected clearSearch(): void {
    this.setSearch('');
    this.filters.search().focusBoundControl();
  }

  protected sortDirection(column: 'description' | 'price'): SortDirection {
    const { sort } = this.query();
    return sort === `${column}-asc`
      ? 'ascending'
      : sort === `${column}-desc`
        ? 'descending'
        : 'none';
  }

  protected sortBy(column: 'description' | 'price'): void {
    const sort =
      this.sortDirection(column) === 'ascending'
        ? (`${column}-desc` as const)
        : (`${column}-asc` as const);
    this.query.update((query) => ({ ...query, sort }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.query(),
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
