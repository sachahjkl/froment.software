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
import { ActivatedRoute, convertToParamMap, Router, RouterLink } from '@angular/router';
import { type InvoiceListValue, type InvoiceSummaryValue } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { BulkSelection } from '@shared/bulk-selection/bulk-selection';
import { TableSort } from '@shared/table-sort/table-sort';
import { PageHeader } from '@shared/page-header/page-header';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { TableExport } from '@shared/table-export/table-export';
import { matchIndices, nextBillingSort, sortDirection } from './billing-list';
import { BillingNav } from './billing-nav';
import { BillingPdf } from './billing-pdf';
import { billingDetailQuery } from './billing-navigation';
import {
  billingFilters,
  billingSort,
  compareInvoices,
  businessToday,
  documentStatus,
  financialStatus,
  invoicePassesFilters,
  type InvoiceSortColumn,
  remainingCents,
  reminderEligible,
} from './billing-state';

@Component({
  host: { class: 'page-container' },
  selector: 'app-billing',
  imports: [
    Can,
    EntityIcon,
    Badge,
    Button,
    DataTable,
    FormField,
    Notice,
    PageHeader,
    RouterLink,
    BillingNav,
    BulkSelection,
    TableSort,
    SearchHighlight,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    DateRangeFilter,
    TableExport,
  ],
  providers: [SearchHighlightRegistry, BillingPdf],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing {
  protected readonly i18n = inject(I18nService);
  protected readonly pdf = inject(BillingPdf);
  private readonly api = inject(InvoicesApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly filters = form(signal(billingFilters(this.route.snapshot.queryParamMap)));
  protected readonly sort = signal(billingSort(this.route.snapshot.queryParamMap));
  protected readonly detailQuery = computed(() =>
    billingDetailQuery(
      'invoices',
      convertToParamMap({ ...this.filters().value(), sort: this.sort() }),
    ),
  );
  protected readonly emptyKey = computed<TranslationKey>(() =>
    this.invoices().length === 0 ? 'billingWorkspace.empty' : 'billingWorkspace.noMatches',
  );
  protected readonly sortDirection = sortDirection;
  protected readonly matchIndices = matchIndices;
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly preparingReminders = signal(false);
  private readonly searchResults = createFuzzySearch(
    this.invoices,
    computed(() => this.filters.q().value()),
    {
      keys: ['invoiceNumber', 'title', 'clientDisplayName', 'orderReference'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly results = computed(() => {
    const collator = new Intl.Collator(this.i18n.language(), {
      numeric: true,
      sensitivity: 'base',
    });
    return this.searchResults()
      .filter(({ item }) => invoicePassesFilters(item, this.filters().value(), businessToday()))
      .toSorted((left, right) =>
        compareInvoices(left.item, right.item, this.sort(), collator, (key) => this.i18n.t(key)),
      );
  });
  protected readonly visible = computed(() => this.results().map(({ item }) => item));
  protected readonly csvColumns = computed(() => [
    this.i18n.t('backOffice.invoices.number'),
    this.i18n.t('backOffice.invoice.title'),
    this.i18n.t('backOffice.invoice.order'),
    this.i18n.t('backOffice.invoices.client'),
    this.i18n.t('billingWorkspace.documentStatus'),
    this.i18n.t('billingWorkspace.financialStatus'),
    this.i18n.t('billingWorkspace.due'),
    `${this.i18n.t('backOffice.invoices.total')} (EUR)`,
    `${this.i18n.t('payment.remaining')} (EUR)`,
  ]);
  protected readonly csvRows = computed(() =>
    this.state() !== 'ready'
      ? []
      : this.visible().map((invoice) => [
          invoice.invoiceNumber,
          invoice.title,
          invoice.orderReference,
          invoice.clientDisplayName,
          this.filterLabel('status', documentStatus(invoice.status)),
          this.i18n.t(financialStatus(invoice)),
          invoice.dueDate,
          invoice.totalCents / 100,
          remainingCents(invoice) / 100,
        ]),
  );
  protected readonly clients = computed(() => [
    ...new Map(
      this.invoices().map((invoice) => [invoice.clientId, invoice.clientDisplayName]),
    ).entries(),
  ]);
  protected readonly clientOptions = computed(() => [
    { value: '', label: this.i18n.t('billingWorkspace.all') },
    ...this.clients().map(([value, label]) => ({ value, label })),
  ]);
  protected readonly statusOptions = computed(() =>
    ['', 'draft', 'issued', 'void'].map((value) => ({
      value,
      label: this.filterLabel('status', value),
    })),
  );
  protected readonly dueOptions = computed(() =>
    ['', 'overdue', 'upcoming'].map((value) => ({
      value,
      label: this.filterLabel('due', value),
    })),
  );
  protected readonly creditOptions = computed(() =>
    ['', 'with', 'without'].map((value) => ({
      value,
      label: this.filterLabel('credit', value),
    })),
  );
  protected readonly selected = computed(() =>
    this.visible().filter((invoice) => this.selectedIds().has(invoice.id)),
  );
  protected readonly allSelected = computed(
    () => this.visible().length > 0 && this.selected().length === this.visible().length,
  );
  protected readonly reminders = computed(() =>
    this.selected().filter((invoice) => reminderEligible(invoice, businessToday())),
  );
  protected readonly exportCount = computed(
    () => this.selected().filter((invoice) => invoice.pdf?.status === 'ready').length,
  );
  protected readonly periodSummary = computed(() => {
    const { from, to } = this.filters().value();
    return (
      [
        from ? `${this.i18n.t('dateRangeFilter.from')} : ${from}` : '',
        to ? `${this.i18n.t('dateRangeFilter.to')} : ${to}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || this.i18n.t('billingWorkspace.all')
    );
  });
  protected readonly activeFilters = computed(() => {
    const values = this.filters().value();
    const filters = Object.entries(values).filter(
      ([key, value]) => key !== 'from' && key !== 'to' && value !== '',
    );
    if (values.from || values.to) filters.push(['period', this.periodSummary()]);
    return filters;
  });
  protected readonly filterCount = computed(
    () => this.activeFilters().filter(([key]) => key !== 'q').length,
  );
  protected readonly documentStatus = documentStatus;
  protected readonly financialStatus = financialStatus;
  protected readonly remaining = remainingCents;
  protected readonly businessDate = businessToday();
  private request = 0;

  protected iconVariant(invoice: InvoiceSummaryValue): EntityIconVariant {
    if (invoice.status === 'draft') return 'default';
    if (invoice.status === 'void') return 'danger';
    if (invoice.creditedCents > 0) return 'default';
    if (remainingCents(invoice) === 0) return 'success';
    if (invoice.dueDate < this.businessDate) return 'danger';
    if (invoice.recordedPaidCents > 0) return 'warning';
    return 'info';
  }

  protected invoiceMatchKey(invoice: InvoiceSummaryValue): 'title' | 'invoiceNumber' {
    return invoice.invoiceNumber === null ? 'title' : 'invoiceNumber';
  }

  protected dueLabel(invoice: InvoiceSummaryValue): string {
    if (invoice.status !== 'issued' || remainingCents(invoice) <= 0 || invoice.creditedCents !== 0)
      return '';
    return this.filterLabel('due', invoice.dueDate < this.businessDate ? 'overdue' : 'upcoming');
  }

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.filters().reset(billingFilters(params));
      this.sort.set(billingSort(params));
      this.selectedIds.set(new Set());
      this.preparingReminders.set(false);
    });
    afterNextRender(() => void this.load());
  }
  protected updateFilters(): void {
    const sort = this.sort();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.filters().value(), sort: sort === 'none' ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected setSearch(value: string): void {
    this.filters.q().value.set(value.slice(0, 160));
    this.updateFilters();
  }
  protected applyPeriod(range: DateRange): void {
    this.filters().reset({
      ...this.filters().value(),
      from: range.from ?? '',
      to: range.to ?? '',
    });
    this.updateFilters();
  }
  protected clearFilter(key?: string): void {
    const values = this.filters().value();
    this.filters().reset(
      key === undefined
        ? { q: '', status: '', client: '', due: '', credit: '', from: '', to: '' }
        : key === 'period'
          ? { ...values, from: '', to: '' }
          : { ...values, [key]: '' },
    );
    this.updateFilters();
  }
  protected sortBy(column: InvoiceSortColumn): void {
    this.sort.set(nextBillingSort(this.sort(), column));
    this.updateFilters();
  }
  protected clearSelection(): void {
    this.selectedIds.set(new Set());
    this.preparingReminders.set(false);
  }
  protected filterLabel(key: string, value: string): string {
    if (value === '') return this.i18n.t('billingWorkspace.all');
    if (key === 'client') return this.clients().find(([id]) => id === value)?.[1] ?? value;
    if (key === 'status' && (value === 'draft' || value === 'issued' || value === 'void'))
      return this.i18n.t(`backOffice.invoice.status.${value}`);
    if (key === 'due')
      return this.i18n.t(
        value === 'overdue' ? 'billingWorkspace.overdue' : 'billingWorkspace.upcoming',
      );
    if (key === 'credit')
      return this.i18n.t(
        value === 'with' ? 'billingWorkspace.hasCredit' : 'billingWorkspace.noCredit',
      );
    return value;
  }
  protected toggle(id: string, checked: boolean): void {
    const selected = new Set(this.selectedIds());
    if (checked) selected.add(id);
    else selected.delete(id);
    this.selectedIds.set(selected);
  }
  protected selectVisible(checked: boolean): void {
    this.selectedIds.set(new Set(checked ? this.visible().map((invoice) => invoice.id) : []));
  }
  protected exportSelected(): void {
    void this.pdf.download(this.selected());
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected async load(): Promise<void> {
    const request = ++this.request;
    this.state.set('loading');
    try {
      const invoices = await this.api.list();
      if (request !== this.request || this.destroyRef.destroyed) return;
      this.invoices.set(invoices);
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && request === this.request) this.state.set('error');
    }
  }
}
import { Can } from '@backoffice/can';
