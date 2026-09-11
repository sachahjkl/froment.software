import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PendingTasks,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { disabled, form, FormField } from '@angular/forms/signals';
import {
  ActivatedRoute,
  convertToParamMap,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice, type FilterChoiceOption } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { TableSort } from '@shared/table-sort/table-sort';
import { PageHeader } from '@shared/page-header/page-header';
import {
  affairColumns,
  affairSortDirection,
  compareAffairs,
  nextAffairSort,
  type AffairColumn,
} from './affair-sort';
import {
  affairFilters,
  affairSort,
  affairStages,
  affairView,
  type AffairStage,
  type AffairView,
} from './affair-filters';
import {
  type ClientListValue,
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';

type PageState = 'loading' | 'ready' | 'error';
type AffairTab = AffairView;

interface Affair {
  readonly quote: QuoteSummaryValue;
  readonly order: OrderSummaryValue | undefined;
  readonly invoice: InvoiceSummaryValue | undefined;
  readonly stage: AffairStage;
  readonly stageLabel: string;
}

@Component({
  host: { class: 'page-container' },
  selector: 'app-affairs',
  imports: [
    Can,
    EntityIcon,
    Badge,
    Button,
    DataTable,
    FilterChip,
    FormField,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    TableSort,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    SearchHighlight,
    TabLayout,
    TabPanel,
    Tabs,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './affairs.html',
  styleUrl: './affairs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Affairs {
  protected readonly i18n = inject(I18nService);
  private readonly quotesApi = inject(QuotesApi);
  private readonly clientsApi = inject(ClientsApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private generation = 0;
  private readonly filterModel = signal(affairFilters(this.route.snapshot.queryParamMap));
  protected readonly state = signal<PageState>('loading');
  private readonly sort = signal(affairSort(this.route.snapshot.queryParamMap));
  protected readonly columns = affairColumns;
  private readonly collator = computed(
    () => new Intl.Collator(this.i18n.language(), { numeric: true, sensitivity: 'base' }),
  );
  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'short', timeStyle: 'short' }),
  );
  protected readonly filters = form(this.filterModel, (path) => {
    disabled(path, { when: () => this.state() !== 'ready' });
  });
  protected readonly activeFilterCount = computed(
    () => Number(!!this.filterModel().stage) + Number(!!this.filterModel().client),
  );
  protected readonly exportColumns = computed(() =>
    this.columns.map((column) => this.i18n.t(column.label)),
  );
  protected exportRows(tab: AffairTab): readonly (readonly string[])[] {
    if (this.state() !== 'ready') return [];
    return this.visibleAffairs(tab).map(({ quote, stageLabel }) => [
      quote.reference,
      quote.title,
      quote.clientDisplayName,
      stageLabel,
      this.money(quote.totalCents),
      this.date(quote.updatedAt),
    ]);
  }
  protected readonly stageOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: '', label: this.i18n.t('commercial.allStages') },
    ...affairStages.map((stage) => ({ value: stage, label: this.stageLabel(stage) })),
  ]);
  protected readonly stageSummary = computed(() => {
    const stage = this.filterModel().stage;
    return stage ? this.stageLabel(stage) : this.i18n.t('commercial.allStages');
  });
  protected readonly clientSummary = computed(() => {
    const client = this.filterModel().client;
    return client ? this.clientLabel(client) : this.i18n.t('commercial.allClients');
  });
  protected readonly hasFilters = computed(() => Object.values(this.filterModel()).some(Boolean));
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  protected readonly clients = signal<ClientListValue>([]);
  protected readonly clientOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: '', label: this.i18n.t('commercial.allClients') },
    ...this.clients().map((client) => ({ value: client.id, label: client.displayName })),
  ]);
  protected readonly tabs = computed<readonly TabItem[]>(() => [
    this.tab('attention', 'backOffice.affairs.attention'),
    this.tab('active', 'backOffice.affairs.active'),
    this.tab('completed', 'backOffice.affairs.completed'),
    this.tab('all', 'backOffice.affairs.all'),
  ]);
  private readonly affairs = computed<readonly Affair[]>(() =>
    this.quotes().map((quote) => {
      const order = this.orders().find((current) => current.quoteId === quote.id);
      const invoice = order
        ? this.invoices().find((current) => current.orderId === order.id)
        : undefined;
      const clientArchived =
        this.clients().find(({ id }) => id === quote.clientId)?.archived ?? false;
      const stage = this.stage(quote, order, invoice, clientArchived);
      return { quote, order, invoice, stage, stageLabel: this.stageLabel(stage) };
    }),
  );
  private readonly search = createFuzzySearch(
    this.affairs,
    computed(() => this.filterModel().q),
    {
      keys: ['quote.reference', 'quote.title', 'quote.clientDisplayName'],
      ignoreLocation: true,
      ignoreDiacritics: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  private readonly results = computed(() =>
    this.search()
      .map((result) => ({
        ...result.item,
        referenceMatches:
          result.matches?.find((match) => match.key === 'quote.reference')?.indices ?? [],
        titleMatches: result.matches?.find((match) => match.key === 'quote.title')?.indices ?? [],
        clientMatches:
          result.matches?.find((match) => match.key === 'quote.clientDisplayName')?.indices ?? [],
      }))
      .filter(
        ({ quote, stage }) =>
          (!this.filterModel().stage || stage === this.filterModel().stage) &&
          (!this.filterModel().client || quote.clientId === this.filterModel().client),
      ),
  );
  private readonly sortedResults = computed(() => {
    const sort = this.sort();
    const collator = this.collator();
    return this.results().toSorted((left, right) => compareAffairs(left, right, sort, collator));
  });
  protected visibleAffairs(tab: AffairTab) {
    if (tab === 'all') return this.sortedResults();
    if (tab === 'completed') {
      return this.sortedResults().filter(({ stage }) =>
        ['paid', 'void', 'rejected', 'expired', 'archived', 'cancelled'].includes(stage),
      );
    }
    if (tab === 'attention') {
      return this.sortedResults().filter(({ stage }) =>
        ['draft', 'ordered', 'invoiceDraft', 'issued'].includes(stage),
      );
    }
    return this.sortedResults().filter(
      ({ stage }) =>
        !['paid', 'void', 'rejected', 'expired', 'archived', 'cancelled'].includes(stage),
    );
  }

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.filterModel.set(affairFilters(params));
        this.sort.set(affairSort(params));
      });
      void this.load();
    });
  }

  protected setFilter(key: 'q' | 'stage' | 'client', value: string): void {
    this.filterModel.update((filters) =>
      affairFilters(convertToParamMap({ ...filters, [key]: value })),
    );
    this.writeQuery(key === 'q');
  }
  protected clearFilters(): void {
    this.filterModel.set({ q: '', stage: '', client: '' });
    this.writeQuery();
    this.filters.q().focusBoundControl();
  }
  protected clientLabel(id: string): string {
    return this.clients().find((client) => client.id === id)?.displayName ?? id;
  }
  protected returnQuery(view: AffairView) {
    const sort = this.sort();
    return { ...this.filterModel(), view, sort: sort === 'none' ? null : sort };
  }
  protected sortDirection(column: AffairColumn) {
    return affairSortDirection(this.sort(), column);
  }
  protected setSort(column: AffairColumn): void {
    this.sort.set(nextAffairSort(this.sort(), column));
    this.writeQuery();
  }
  private writeQuery(replaceUrl = false): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.returnQuery(this.currentView()),
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }
  protected currentView(): AffairView {
    return affairView(convertToParamMap({ view: this.route.firstChild?.snapshot.url[0]?.path }));
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected date(value: string): string {
    return this.dateFormat().format(new Date(value));
  }

  protected stageLabel(stage: AffairStage): string {
    return this.i18n.t(`backOffice.affairs.stage.${stage}`);
  }

  protected stageVariant(stage: AffairStage): BadgeVariant {
    if (stage === 'paid') return 'success';
    if (['void', 'rejected', 'archived', 'cancelled'].includes(stage)) return 'danger';
    if (stage === 'sent' || stage === 'issued' || stage === 'expired') return 'warning';
    return 'default';
  }

  protected actionLabel(affair: Affair): string {
    if (affair.invoice) return this.i18n.t('backOffice.affairs.openInvoice');
    if (affair.order) return this.i18n.t('backOffice.affairs.createInvoice');
    return this.i18n.t('backOffice.affairs.openQuote');
  }

  protected async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    const finishLoading = this.pendingTasks.add();
    try {
      const [quotes, orders, invoices, clients] = await Promise.all([
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
        this.clientsApi.list(),
      ]);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.clients.set(clients);
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) this.state.set('error');
    } finally {
      finishLoading();
    }
  }

  private stage(
    quote: QuoteSummaryValue,
    order: OrderSummaryValue | undefined,
    invoice: InvoiceSummaryValue | undefined,
    clientArchived: boolean,
  ): AffairStage {
    if (invoice) {
      if (invoice.status === 'draft') return 'invoiceDraft';
      return invoice.status;
    }
    if (order) return 'ordered';
    if (clientArchived) return 'archived';
    if (quote.status === 'sent') return 'sent';
    if (quote.status === 'rejected') return 'rejected';
    if (quote.status === 'expired') return 'expired';
    if (quote.status === 'cancelled') return 'cancelled';
    return 'draft';
  }

  private tab(value: AffairTab, label: TranslationKey): TabItem {
    return {
      path: value,
      id: `affairs-${value}-tab`,
      label: this.i18n.t(label),
    };
  }
}
import { formatMoney } from '@froment/l10n';
import { Can } from '@backoffice/can';
