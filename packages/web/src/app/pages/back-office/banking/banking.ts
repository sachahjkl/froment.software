import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type BankTransactionValue } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { BankingApi } from '@backoffice/banking-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { DataTable } from '@shared/data-table/data-table';
import { EmptyState } from '@shared/empty-state/empty-state';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice, type FilterChoiceOption } from '@shared/filter-choice/filter-choice';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { TableExport } from '@shared/table-export/table-export';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Tabs } from '@shared/tabs/tabs';
import { TableSort } from '@shared/table-sort/table-sort';
import { bankSortDirection, compareBankRows, nextBankSort } from './bank-table-sort';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import {
  bankQuery,
  bankQueryParams,
  bankColumns,
  bankStatus,
  bankStatusLabel,
  bankStatuses,
  bankTabs,
  transactionLink,
  validBankPeriod,
} from './bank-workspace';

@Component({
  host: { class: 'page-container' },
  selector: 'app-banking',
  imports: [
    Button,
    Badge,
    DataTable,
    EmptyState,
    EntityIcon,
    FilterChip,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    DateRangeFilter,
    TableExport,
    Notice,
    PageHeader,
    FormField,
    LocalizedDatePipe,
    RouterLink,
    Tabs,
    TableSort,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './banking.scss',
  templateUrl: './banking.html',
})
export class Banking {
  protected iconVariant(transaction: BankTransactionValue): EntityIconVariant {
    switch (bankStatus(transaction)) {
      case 'matched':
        return 'success';
      case 'partial':
        return 'warning';
      case 'cancelledPayment':
        return 'danger';
      case 'unmatched':
        return 'info';
      case 'notApplicable':
        return 'default';
    }
  }

  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly transactions = signal<ReadonlyArray<BankTransactionValue>>([]);
  protected readonly query = signal(bankQuery(this.route.snapshot.queryParamMap));
  protected readonly queryParams = computed(() => bankQueryParams(this.query()));
  private readonly model = signal(this.query());
  protected readonly filters = form(this.model);
  private readonly searchControl = viewChild(ListSearch);
  private readonly filterMenu = viewChild(FilterMenu);
  protected readonly tabs = computed(() => bankTabs(this.i18n));
  protected readonly columns = bankColumns;
  protected readonly statusLabel = bankStatusLabel;
  protected readonly status = bankStatus;
  protected readonly transactionLink = transactionLink;
  protected readonly periodInvalid = computed(
    () => !validBankPeriod(this.model().from, this.model().to),
  );
  private readonly accounts = computed(() =>
    [...new Set(this.transactions().map((item) => item.account))].toSorted(
      new Intl.Collator(this.i18n.language(), { numeric: true, sensitivity: 'base' }).compare,
    ),
  );
  protected readonly accountOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: '', label: this.i18n.t('bankWorkspace.allAccounts') },
    ...this.accounts().map((account) => ({ value: account, label: account })),
  ]);
  protected readonly flowOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: '', label: this.i18n.t('bankWorkspace.all') },
    { value: 'credit', label: this.i18n.t('bankWorkspace.credit') },
    { value: 'debit', label: this.i18n.t('bankWorkspace.debit') },
  ]);
  protected readonly statusOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: '', label: this.i18n.t('bankWorkspace.all') },
    ...bankStatuses.map((status) => ({
      value: status,
      label: this.i18n.t(bankStatusLabel(status)),
    })),
  ]);
  protected readonly periodSummary = computed(() => {
    const { from, to } = this.query();
    return from || to ? `${from || '…'} → ${to || '…'}` : this.i18n.t('bankWorkspace.allDates');
  });
  protected readonly chips = computed(() =>
    Object.entries(this.query())
      .filter(([key, value]) => key !== 'sort' && value !== '')
      .map(([key, value]) => ({ key, value })),
  );
  protected readonly activeFilterCount = computed(
    () =>
      Number(this.query().account !== '') +
      Number(this.query().flow !== '') +
      Number(this.query().status !== '') +
      Number(this.query().from !== '' || this.query().to !== ''),
  );
  protected readonly exportColumns = [
    'transaction_id',
    'reference',
    'description',
    'account',
    'booked_on',
    'status',
    'amount_cents',
    'currency',
  ];
  protected readonly exportRows = computed(() =>
    this.state() === 'ready'
      ? this.visible().map(({ item }) => [
          item.id,
          item.reference,
          item.description,
          item.account,
          item.bookedOn,
          bankStatus(item),
          item.amountCents,
          'EUR',
        ])
      : [],
  );
  private readonly filtered = computed(() => {
    const query = this.query();
    if (!validBankPeriod(query.from, query.to)) return [];
    return this.transactions().filter(
      (item) =>
        (!query.account || item.account === query.account) &&
        (!query.from || item.bookedOn >= query.from) &&
        (!query.to || item.bookedOn <= query.to) &&
        (!query.flow || (query.flow === 'credit' ? item.amountCents > 0 : item.amountCents < 0)) &&
        (!query.status || bankStatus(item) === query.status),
    );
  });
  private readonly search = createFuzzySearch(
    this.filtered,
    computed(() => this.query().q),
    {
      keys: ['reference', 'description'],
      includeMatches: true,
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
    },
  );
  protected readonly visible = computed(() => {
    const compare = compareBankRows(
      this.query().sort,
      bankColumns,
      this.i18n.language(),
      (row) => row.id,
    );
    return this.search()
      .toSorted((left, right) => compare(left.item, right.item))
      .map((result) => ({
        item: result.item,
        referenceMatches: result.matches?.find((match) => match.key === 'reference')?.indices ?? [],
        descriptionMatches:
          result.matches?.find((match) => match.key === 'description')?.indices ?? [],
      }));
  });
  private generation = 0;
  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = bankQuery(params);
        this.query.set(query);
        this.model.set(query);
      });
      void this.pendingTasks.run(() => this.load());
    });
  }
  async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    try {
      const transactions = await this.api.list();
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      this.transactions.set(transactions);
      this.state.set('ready');
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) this.state.set('error');
    }
  }
  protected updateFilter(key: string, value: string): void {
    this.model.update((model) => ({ ...model, [key]: value }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams(this.model()),
      queryParamsHandling: 'merge',
      replaceUrl: key === 'q',
    });
  }
  protected applyPeriod(range: DateRange): void {
    const from = range.from ?? '';
    const to = range.to ?? '';
    if (!validBankPeriod(from, to)) return;
    this.model.update((model) => ({ ...model, from, to }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams(this.model()),
      queryParamsHandling: 'merge',
    });
    this.filterMenu()?.close();
  }
  protected clear(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams({ sort: this.query().sort }),
    });
    this.searchControl()?.focus();
  }
  protected sortDirection(column: string) {
    return bankSortDirection(this.query().sort, column);
  }
  protected sortBy(column: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams({ sort: nextBankSort(this.query().sort, column) }),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected chipLabel(key: string, value: string): string {
    if (key === 'flow')
      return this.i18n.t(value === 'credit' ? 'bankWorkspace.credit' : 'bankWorkspace.debit');
    const status = bankStatuses.find((status) => status === value);
    if (key === 'status' && status) return this.i18n.t(bankStatusLabel(status));
    const label =
      key === 'from'
        ? 'ledger.from'
        : key === 'to'
          ? 'ledger.to'
          : key === 'account'
            ? 'bankWorkspace.account'
            : 'bankWorkspace.search';
    return `${this.i18n.t(label)} : ${value}`;
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
