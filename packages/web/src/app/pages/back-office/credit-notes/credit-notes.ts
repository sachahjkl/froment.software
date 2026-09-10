import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CreditNoteList } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { TableSort } from '@shared/table-sort/table-sort';
import { PageHeader } from '@shared/page-header/page-header';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { TableExport } from '@shared/table-export/table-export';
import { matchIndices, nextBillingSort, sortDirection } from '../billing/billing-list';
import {
  compareEntries,
  entrySort,
  creditSortColumns,
  entryExportEmptyKey,
  entryEmptyKey,
} from '../billing/entry-list';
import { billingDetailQuery } from '../billing/billing-navigation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { BillingNav } from '../billing/billing-nav';
import { businessDate } from '../billing/billing-state';
import { EntryFilters, EntryFilterState } from '../billing/entry-filters';

@Component({
  selector: 'app-credit-notes',
  imports: [
    EntityIcon,
    Button,
    Notice,
    PageHeader,
    DataTable,
    RouterLink,
    LocalizedDatePipe,
    BillingNav,
    EntryFilters,
    TableSort,
    SearchHighlight,
    ListWorkspace,
    TableExport,
  ],
  providers: [EntryFilterState, SearchHighlightRegistry],
  templateUrl: './credit-notes.html',
  styleUrl: './credit-notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container' },
})
export class CreditNotes {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly filters = inject(EntryFilterState);
  protected readonly detailQuery = computed(() =>
    billingDetailQuery('credits', this.filters.params(), 'credit'),
  );
  protected readonly emptyKey = computed(() => entryEmptyKey(this.rows().length));
  protected readonly exportEmptyKey = computed(() => entryExportEmptyKey(this.state()));
  protected readonly rows = signal<typeof CreditNoteList.Type>([]);
  protected readonly sort = computed(() => entrySort(this.filters.params(), creditSortColumns));
  protected readonly sortDirection = sortDirection;
  protected readonly matchIndices = matchIndices;
  private readonly searchResults = createFuzzySearch(
    this.rows,
    computed(() => this.filters.fields.q().value()),
    {
      keys: ['number', 'reason', 'invoiceNumber', 'title', 'clientDisplayName', 'orderReference'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly visible = computed(() => {
    const collator = new Intl.Collator(this.i18n.language(), {
      numeric: true,
      sensitivity: 'base',
    });
    return this.searchResults()
      .filter(({ item }) => this.filters.passes(item, businessDate(item.issuedAt)))
      .toSorted((left, right) =>
        compareEntries(left.item, right.item, this.sort(), collator, (key) => this.i18n.t(key)),
      );
  });
  protected sortBy(column: (typeof creditSortColumns)[number]): void {
    this.filters.updateSort(nextBillingSort(this.sort(), column));
  }
  protected readonly clients = computed(() => [
    ...new Map(this.rows().map((entry) => [entry.clientId, entry.clientDisplayName])).entries(),
  ]);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'limit'>('loading');
  protected readonly csvColumns = computed(() => [
    this.i18n.t('credit.title'),
    this.i18n.t('credit.reason'),
    this.i18n.t('backOffice.invoices.number'),
    this.i18n.t('backOffice.invoice.title'),
    this.i18n.t('backOffice.invoice.order'),
    this.i18n.t('backOffice.invoices.client'),
    this.i18n.t('billingWorkspace.issuedAt'),
    `${this.i18n.t('backOffice.invoice.total')} (EUR)`,
  ]);
  protected readonly csvRows = computed(() =>
    this.state() !== 'ready'
      ? []
      : this.visible().map(({ item: entry }) => [
          entry.number,
          entry.reason,
          entry.invoiceNumber,
          entry.title,
          entry.orderReference,
          entry.clientDisplayName,
          entry.issuedAt,
          entry.totalCents / 100,
        ]),
  );
  constructor() {
    afterNextRender(() => void this.load());
  }
  protected async load(): Promise<void> {
    this.state.set('loading');
    this.rows.set([]);
    try {
      const outcome = await this.api.credits();
      if (this.destroyRef.destroyed) return;
      if (outcome.success) {
        this.rows.set(outcome.result);
        this.state.set('ready');
      } else this.state.set(outcome.code === 'invoice.workspace_limit' ? 'limit' : 'error');
    } catch {
      if (!this.destroyRef.destroyed) this.state.set('error');
    }
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
