import { Can } from '@backoffice/can';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { type ClientSummaryValue } from '@froment/contracts';
import { ClientsApi } from '@backoffice/clients-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { PageHeader } from '@shared/page-header/page-header';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { EmptyState } from '@shared/empty-state/empty-state';
import { Icon } from '@shared/icon/icon';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { clientContactIncomplete } from './client-contact';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { nextTableSort } from '@shared/table-sort/sort-state';
import {
  clientFilters,
  clientFilterQuery,
  type ClientView,
  type ClientSortColumn,
} from './client-filters';

@Component({
  host: { class: 'page-container' },
  selector: 'app-clients',
  imports: [
    Can,
    EntityIcon,
    Badge,
    Button,
    DataTable,
    FormField,
    FilterChip,
    Notice,
    RouterLink,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    PageHeader,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    EmptyState,
    Icon,
    SearchHighlight,
    TableSort,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadGeneration = 0;
  protected readonly clients = signal<ReadonlyArray<ClientSummaryValue>>([]);
  private readonly model = signal(clientFilters(this.route.snapshot.queryParamMap));
  private readonly collator = computed(
    () => new Intl.Collator(this.i18n.language(), { numeric: true, sensitivity: 'base' }),
  );
  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'medium' }),
  );
  protected readonly filters = form(this.model);
  protected readonly filtered = computed(
    () =>
      this.model().search.trim() !== '' ||
      this.model().country !== '' ||
      this.model().contact !== 'all',
  );
  protected readonly activeFilterCount = computed(
    () => Number(this.model().country !== '') + Number(this.model().contact !== 'all'),
  );
  protected readonly exportColumns = computed(() => [
    this.i18n.t('backOffice.clients.displayName'),
    this.i18n.t('backOffice.clients.email'),
    this.i18n.t('backOffice.clients.city'),
    this.i18n.t('backOffice.clients.country'),
    this.i18n.t('clientsWorkspace.updatedAt'),
    this.i18n.t('backOffice.clients.status'),
  ]);
  private readonly countries = computed(() =>
    [
      ...new Set(
        this.clients()
          .map(({ country }) => country)
          .filter(Boolean),
      ),
    ].sort(this.collator().compare),
  );
  protected readonly countryOptions = computed(() => [
    { value: '', label: this.i18n.t('clientsWorkspace.countryFilter') },
    ...this.countries().map((country) => ({ value: country, label: country })),
  ]);
  protected readonly contactOptions = computed(() => [
    { value: 'all', label: this.i18n.t('clientsWorkspace.contactAll') },
    { value: 'incomplete', label: this.i18n.t('clientsWorkspace.contactIncomplete') },
  ]);
  protected readonly contactFilterLabel = computed(() =>
    this.i18n.t(
      this.model().contact === 'incomplete'
        ? 'clientsWorkspace.contactIncomplete'
        : 'clientsWorkspace.contactAll',
    ),
  );
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['active', 'archived', 'all'] as const).map((value) => ({
      path: value,
      id: `clients-${value}-tab`,
      label: this.i18n.t(`backOffice.clients.tab.${value}`),
    })),
  );
  private readonly searchResults = createFuzzySearch(
    this.clients,
    computed(() => this.filters.search().value()),
    {
      keys: ['displayName', 'email', 'city', 'country'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  private readonly results = computed(() => {
    const sort = this.model().sort === 'none' ? 'name-asc' : this.model().sort;
    const direction = sort.endsWith('-desc') ? -1 : 1;
    const collator = this.collator();
    return this.searchResults()
      .toSorted(({ item: left }, { item: right }) => {
        const comparison = sort.startsWith('date-')
          ? left.updatedAt - right.updatedAt
          : collator.compare(
              sort.startsWith('country-') ? left.country : left.displayName,
              sort.startsWith('country-') ? right.country : right.displayName,
            );
        return comparison * direction || left.id.localeCompare(right.id);
      })
      .map((result) => ({
        client: result.item,
        nameMatches: result.matches?.find((match) => match.key === 'displayName')?.indices ?? [],
        emailMatches: result.matches?.find((match) => match.key === 'email')?.indices ?? [],
      }));
  });
  protected visibleClients(selected: ClientView) {
    return this.results().filter(
      ({ client }) =>
        (selected === 'all' || client.archived === (selected === 'archived')) &&
        (!this.model().country || client.country === this.model().country) &&
        (this.model().contact === 'all' || clientContactIncomplete(client)),
    );
  }
  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => this.model.set(clientFilters(params)));
      void this.load();
    });
  }

  protected setFilter(field: 'search' | 'country' | 'contact', value: string): void {
    if (field === 'contact') {
      this.model.update((model) => ({
        ...model,
        contact: value === 'incomplete' ? 'incomplete' : 'all',
      }));
    } else {
      this.model.update((model) => ({ ...model, [field]: value.slice(0, 120) }));
    }
    this.writeQuery();
  }

  protected resetFilters(): void {
    this.model.update((model) => ({ ...model, search: '', country: '', contact: 'all' }));
    this.writeQuery();
    this.filters.search().focusBoundControl();
  }

  protected sortDirection(column: ClientSortColumn): SortDirection {
    const { sort } = this.model();
    return sort === `${column}-asc`
      ? 'ascending'
      : sort === `${column}-desc`
        ? 'descending'
        : 'none';
  }

  protected sortBy(column: ClientSortColumn): void {
    const sort = nextTableSort(this.model().sort, `${column}-asc`, `${column}-desc`);
    this.model.update((model) => ({ ...model, sort }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: sort === 'none' ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected detailQuery(view: ClientView) {
    return { ...clientFilterQuery(this.model()), view: view === 'active' ? undefined : view };
  }

  protected statusVariant(client: ClientSummaryValue): BadgeVariant {
    if (client.archived) return 'warning';
    return 'success';
  }

  protected exportRows(view: ClientView): readonly (readonly (string | number | null)[])[] {
    if (this.state() !== 'ready') return [];
    return this.visibleClients(view).map(({ client }) => [
      client.displayName,
      client.email,
      client.city,
      client.country,
      this.date(client.updatedAt),
      this.i18n.t(client.archived ? 'backOffice.clients.archived' : 'backOffice.clients.active'),
    ]);
  }

  protected date(timestamp: number): string {
    return this.dateFormat().format(timestamp);
  }

  protected dateTime(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  private writeQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clientFilterQuery(this.model()),
      replaceUrl: true,
    });
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    try {
      const clients = await this.api.list();
      if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
      this.clients.set(clients);
      this.state.set('ready');
    } catch {
      if (generation === this.loadGeneration && !this.destroyRef.destroyed) this.state.set('error');
    }
  }
}
