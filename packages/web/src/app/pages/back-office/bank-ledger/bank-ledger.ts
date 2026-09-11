import { Authentication } from '@backoffice/authentication';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LedgerPeriod, type LedgerList } from '@froment/contracts';
import { Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { ledgerErrorMessage } from './ledger-error-message';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EmptyState } from '@shared/empty-state/empty-state';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { TableExport } from '@shared/table-export/table-export';
import { Hint } from '@shared/hint/hint';
import { Icon } from '@shared/icon/icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TableSort } from '@shared/table-sort/table-sort';
import {
  bankTableSort,
  bankSortDirection,
  compareBankRows,
  nextBankSort,
} from '../banking/bank-table-sort';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import {
  bankTabs,
  bankQueryParams,
  ledgerEntryColumns,
  ledgerSourceColumns,
  ledgerEntryLink,
  ledgerQuery,
  ledgerSourceLink,
} from '../banking/bank-workspace';

@Component({
  selector: 'app-bank-ledger',
  host: { class: 'page-container' },
  imports: [
    Badge,
    Button,
    DataTable,
    EmptyState,
    FilterChip,
    FormField,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    DateRangeFilter,
    TableExport,
    Hint,
    Icon,
    LocalizedDatePipe,
    Notice,
    PageHeader,
    RouterLink,
    SearchHighlight,
    Tabs,
    TableSort,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './bank-ledger.html',
  styleUrl: './bank-ledger.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankLedger {
  protected readonly authentication = inject(Authentication);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankLedgerApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly errorMessage = computed(() => ledgerErrorMessage(this.error(), 'load'));
  protected readonly records = signal<typeof LedgerList.Type>({ entries: [], sources: [] });
  protected readonly query = signal(ledgerQuery(this.route.snapshot.queryParamMap));
  protected readonly queryParams = computed(() => bankQueryParams(this.query()));
  protected readonly periodRequired = signal(false);
  private readonly periodError = viewChild('periodError', { read: ElementRef<HTMLElement> });
  protected readonly searchForm = form(signal({ q: this.query().q }));
  protected readonly activeFilterCount = computed(() =>
    Number(this.query().from !== '' || this.query().to !== ''),
  );
  private readonly filterMenu = viewChild(FilterMenu);
  private readonly searchControl = viewChild(ListSearch);
  protected readonly tabs = computed(() =>
    bankTabs(this.i18n, (permission) => this.authentication.can(permission)),
  );
  protected readonly viewTabs = computed<readonly TabItem[]>(() =>
    (['sources', 'journal'] as const).map((view) => ({
      path: '.',
      id: `bank-${view}-tab`,
      label: this.i18n.t(`bankWorkspace.${view}`),
      queryParams: this.viewQuery(view),
      active: this.query().view === view,
    })),
  );
  protected readonly sourceLink = ledgerSourceLink;
  protected readonly entryLink = ledgerEntryLink;
  protected readonly sourceColumns = ledgerSourceColumns;
  protected readonly entryColumns = ledgerEntryColumns;
  private readonly sources = computed(() =>
    this.records().sources.filter((source) => source.entryId === null),
  );
  private readonly sourceSearch = createFuzzySearch(
    this.sources,
    computed(() => this.query().q),
    {
      keys: ['reference', 'account'],
      includeMatches: true,
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
    },
  );
  protected readonly sourceResults = computed(() => {
    const compare = compareBankRows(
      bankTableSort(this.query().sort, ledgerSourceColumns),
      ledgerSourceColumns,
      this.i18n.language(),
      (row) => `${row.sourceId}/${row.sourceKind}`,
    );
    return this.sourceSearch()
      .toSorted((left, right) => compare(left.item, right.item))
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'reference')?.indices ?? [],
      }));
  });
  private readonly entrySearch = createFuzzySearch(
    computed(() => this.records().entries),
    computed(() => this.query().q),
    {
      keys: ['label', 'id', 'sourceReference'],
      includeMatches: true,
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
    },
  );
  protected readonly entryResults = computed(() => {
    const compare = compareBankRows(
      bankTableSort(this.query().sort, ledgerEntryColumns),
      ledgerEntryColumns,
      this.i18n.language(),
      (row) => row.id,
    );
    return this.entrySearch()
      .toSorted((left, right) => compare(left.item, right.item))
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'label')?.indices ?? [],
        referenceIndices:
          result.matches?.find((match) => match.key === 'sourceReference')?.indices ?? [],
      }));
  });
  protected readonly count = computed(() =>
    this.query().view === 'journal' ? this.entryResults().length : this.sourceResults().length,
  );
  protected readonly exportColumns = computed(() =>
    this.query().view === 'journal'
      ? [
          'entry_id',
          'label',
          'source_reference',
          'booked_on',
          'debit_account',
          'credit_account',
          'status',
          'amount_cents',
          'currency',
        ]
      : [
          'source_kind',
          'source_id',
          'reference',
          'account',
          'booked_on',
          'amount_cents',
          'currency',
        ],
  );
  protected readonly exportRows = computed(() => {
    if (this.state() !== 'ready') return [];
    return this.query().view === 'journal'
      ? this.entryResults().map(({ item }) => [
          item.id,
          item.label,
          item.sourceReference,
          item.bookedOn,
          item.debitAccount,
          item.creditAccount,
          item.reversesId ? 'reversal' : item.reversalId ? 'reversed' : 'active',
          item.amountCents,
          'EUR',
        ])
      : this.sourceResults().map(({ item }) => [
          item.sourceKind,
          item.sourceId,
          item.reference,
          item.account,
          item.bookedOn,
          item.amountCents,
          'EUR',
        ]);
  });
  protected readonly exportUrl = computed(() =>
    this.state() === 'ready'
      ? `/api/banking/ledger/export?${new URLSearchParams({ from: this.query().from, to: this.query().to })}`
      : undefined,
  );
  private loadedKey = '';
  private generation = 0;
  constructor() {
    afterRenderEffect(() => {
      if (this.periodRequired()) this.periodError()?.nativeElement.focus();
    });
    afterNextRender(() =>
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = ledgerQuery(params);
        this.query.set(query);
        this.searchForm().reset({ q: query.q });
        const key = `${query.from}/${query.to}`;
        if (key !== this.loadedKey) {
          this.loadedKey = key;
          void this.pendingTasks.run(() => this.load());
        }
      }),
    );
  }
  protected async load(): Promise<void> {
    const generation = ++this.generation;
    const period = { from: this.query().from, to: this.query().to };
    if (!Schema.is(LedgerPeriod)(period)) {
      this.state.set('error');
      this.error.set('bankWorkspace.periodInvalid');
      return;
    }
    this.state.set('loading');
    this.error.set(undefined);
    try {
      const outcome = await this.api.list(period);
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      this.records.set(outcome.result);
      this.state.set('ready');
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) {
        this.error.set('ledger.error');
        this.state.set('error');
      }
    }
  }
  protected applyPeriod(range: DateRange): void {
    const period = { from: range.from ?? '', to: range.to ?? '' };
    if (!Schema.is(LedgerPeriod)(period)) {
      this.periodRequired.set(true);
      return;
    }
    this.periodRequired.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams({ ...this.query(), ...period }),
      queryParamsHandling: 'merge',
    });
    this.filterMenu()?.close();
  }
  protected search(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: bankQueryParams({ ...this.query(), q: value }),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (value === '') this.searchControl()?.focus();
  }
  protected viewQuery(view: string) {
    const sort =
      view === 'journal'
        ? bankTableSort(this.query().sort, ledgerEntryColumns)
        : bankTableSort(this.query().sort, ledgerSourceColumns);
    return bankQueryParams({ ...this.query(), view, sort });
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
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
