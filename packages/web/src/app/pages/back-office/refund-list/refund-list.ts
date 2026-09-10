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
import { InvoiceRefundList } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { TableSort } from '@shared/table-sort/table-sort';
import { PageHeader } from '@shared/page-header/page-header';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { TableExport } from '@shared/table-export/table-export';
import { matchIndices, nextBillingSort, sortDirection } from '../billing/billing-list';
import { compareEntries, entrySort, refundSortColumns } from '../billing/entry-list';
import { BillingNav } from '../billing/billing-nav';
import { EntryFilters, EntryFilterState } from '../billing/entry-filters';

@Component({
  selector: 'app-refund-list',
  imports: [
    EntityIcon,
    Button,
    Notice,
    PageHeader,
    DataTable,
    RouterLink,
    BillingNav,
    EntryFilters,
    TableSort,
    SearchHighlight,
    ListWorkspace,
    TableExport,
  ],
  providers: [EntryFilterState, SearchHighlightRegistry],
  templateUrl: './refund-list.html',
  styleUrl: './refund-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container' },
})
export class RefundList {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly filters = inject(EntryFilterState);
  protected readonly rows = signal<typeof InvoiceRefundList.Type>([]);
  protected readonly sort = computed(() => entrySort(this.filters.params(), refundSortColumns));
  protected readonly sortDirection = sortDirection;
  protected readonly matchIndices = matchIndices;
  private readonly searchResults = createFuzzySearch(
    this.rows,
    computed(() => this.filters.fields.q().value()),
    {
      keys: ['reference', 'invoiceNumber', 'title', 'clientDisplayName', 'orderReference'],
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
      .filter(({ item }) => this.filters.passes(item, item.refundedOn))
      .toSorted((left, right) =>
        compareEntries(left.item, right.item, this.sort(), collator, (key) => this.i18n.t(key)),
      );
  });
  protected sortBy(column: (typeof refundSortColumns)[number]): void {
    this.filters.updateSort(nextBillingSort(this.sort(), column));
  }
  protected iconVariant(entry: (typeof InvoiceRefundList.Type)[number]): EntityIconVariant {
    if (entry.cancelledAt === null) return 'success';
    return 'danger';
  }
  protected readonly clients = computed(() => [
    ...new Map(this.rows().map((entry) => [entry.clientId, entry.clientDisplayName])).entries(),
  ]);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'limit'>('loading');
  protected readonly csvColumns = computed(() => [
    this.i18n.t('credit.reference'),
    this.i18n.t('backOffice.invoices.number'),
    this.i18n.t('backOffice.invoice.title'),
    this.i18n.t('backOffice.invoice.order'),
    this.i18n.t('backOffice.invoices.client'),
    this.i18n.t('credit.refundedOn'),
    this.i18n.t('billingWorkspace.financialStatus'),
    `${this.i18n.t('credit.amount')} (EUR)`,
  ]);
  protected readonly csvRows = computed(() =>
    this.state() !== 'ready'
      ? []
      : this.visible().map(({ item: entry }) => [
          entry.reference,
          entry.invoiceNumber,
          entry.title,
          entry.orderReference,
          entry.clientDisplayName,
          entry.refundedOn,
          this.i18n.t(
            entry.cancelledAt === null ? 'billingWorkspace.active' : 'billingWorkspace.cancelled',
          ),
          entry.amountCents / 100,
        ]),
  );
  constructor() {
    afterNextRender(() => void this.load());
  }
  protected async load(): Promise<void> {
    this.state.set('loading');
    this.rows.set([]);
    try {
      const outcome = await this.api.refunds();
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
