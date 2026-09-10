import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { disabled, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { CalendarDate, InvoiceReceiptList } from '@froment/contracts';
import { Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { TableSort } from '@shared/table-sort/table-sort';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { TableExport } from '@shared/table-export/table-export';
import { Hint } from '@shared/hint/hint';
import { Icon } from '@shared/icon/icon';
import { matchIndices, nextBillingSort, sortDirection } from '../billing/billing-list';
import {
  compareEntries,
  entrySort,
  receiptSortColumns,
  type EntrySortColumn,
} from '../billing/entry-list';
import { BillingNav } from '../billing/billing-nav';
import { EntryFilters, EntryFilterState } from '../billing/entry-filters';
import { paymentMethodKey } from '../billing/billing-state';

@Component({
  selector: 'app-receipt-list',
  imports: [
    EntityIcon,
    Button,
    Notice,
    DataTable,
    RouterLink,
    FormField,
    BillingNav,
    EntryFilters,
    TableSort,
    SearchHighlight,
    ListWorkspace,
    TableExport,
    Hint,
    Icon,
  ],
  providers: [EntryFilterState, SearchHighlightRegistry],
  templateUrl: './receipt-list.html',
  styleUrl: './receipt-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container' },
})
export class ReceiptList {
  protected readonly paymentMethodKey = paymentMethodKey;
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focusInvalid = signal(false);
  protected readonly filters = inject(EntryFilterState);
  protected readonly rows = signal<typeof InvoiceReceiptList.Type>([]);
  protected readonly sort = computed(() => entrySort(this.filters.params(), receiptSortColumns));
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
      .filter(({ item }) => this.filters.passes(item, item.paidOn))
      .toSorted((left, right) =>
        compareEntries(left.item, right.item, this.sort(), collator, (key) => this.i18n.t(key)),
      );
  });
  protected sortBy(column: EntrySortColumn): void {
    this.filters.updateSort(nextBillingSort(this.sort(), column));
  }
  protected iconVariant(entry: (typeof InvoiceReceiptList.Type)[number]): EntityIconVariant {
    if (entry.cancelledAt === null) return 'success';
    return 'danger';
  }
  protected readonly clients = computed(() => [
    ...new Map(this.rows().map((entry) => [entry.clientId, entry.clientDisplayName])).entries(),
  ]);
  protected readonly state = signal<'loading' | 'ready' | 'error' | 'limit'>('loading');
  protected readonly csvColumns = computed(() => [
    this.i18n.t('payment.reference'),
    this.i18n.t('backOffice.invoices.number'),
    this.i18n.t('backOffice.invoice.title'),
    this.i18n.t('backOffice.invoice.order'),
    this.i18n.t('backOffice.invoices.client'),
    this.i18n.t('payment.date'),
    this.i18n.t('payment.method'),
    this.i18n.t('billingWorkspace.financialStatus'),
    `${this.i18n.t('payment.amount')} (EUR)`,
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
          entry.paidOn,
          this.i18n.t(paymentMethodKey(entry.method)),
          this.i18n.t(
            entry.cancelledAt === null ? 'billingWorkspace.active' : 'billingWorkspace.cancelled',
          ),
          entry.amountCents / 100,
        ]),
  );
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly exporting = signal(false);
  protected readonly exported = signal(false);
  protected readonly exportForm = form(signal({ from: '', to: '' }), (path) => {
    disabled(path, () => this.exporting());
    required(path.from);
    required(path.to);
    validate(path.from, ({ value }) =>
      Schema.is(CalendarDate)(value()) ? undefined : { kind: 'date' },
    );
    validate(path.to, ({ value, valueOf }) =>
      Schema.is(CalendarDate)(value()) && value() >= valueOf(path.from)
        ? undefined
        : { kind: 'date' },
    );
  });
  private exportUrl: string | undefined;
  constructor() {
    afterNextRender(() => void this.load());
    afterRenderEffect(() => {
      if (this.focusInvalid()) {
        this.element.nativeElement
          .querySelector<HTMLElement>('.payment-export [aria-invalid="true"]')
          ?.focus();
        this.focusInvalid.set(false);
      } else if (this.error() || this.exported()) {
        this.element.nativeElement.querySelector<HTMLElement>('[data-export-feedback]')?.focus();
      }
    });
    this.destroyRef.onDestroy(() => {
      if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
    });
  }
  protected async load(): Promise<void> {
    this.state.set('loading');
    this.rows.set([]);
    try {
      const outcome = await this.api.receipts();
      if (this.destroyRef.destroyed) return;
      if (outcome.success) {
        this.rows.set(outcome.result);
        this.state.set('ready');
      } else this.state.set(outcome.code === 'invoice.workspace_limit' ? 'limit' : 'error');
    } catch {
      if (!this.destroyRef.destroyed) this.state.set('error');
    }
  }
  protected exportPayments(event: Event): void {
    event.preventDefault();
    if (this.exporting()) return;
    void submit(this.exportForm, {
      action: async () => {
        this.exporting.set(true);
        this.error.set(undefined);
        this.exported.set(false);
        try {
          const outcome = await this.api.exportPayments(this.exportForm().value());
          if (this.destroyRef.destroyed) return;
          if (!outcome.success) {
            this.error.set(outcome.code);
            return;
          }
          if (this.exportUrl) URL.revokeObjectURL(this.exportUrl);
          this.exportUrl = URL.createObjectURL(
            new Blob([outcome.result], { type: 'text/csv;charset=utf-8' }),
          );
          const link = document.createElement('a');
          link.href = this.exportUrl;
          link.download = 'invoice-payments.csv';
          link.click();
          this.exported.set(true);
        } catch {
          if (!this.destroyRef.destroyed) this.error.set('payment.export_error');
        } finally {
          if (!this.destroyRef.destroyed) this.exporting.set(false);
        }
      },
      onInvalid: () => this.focusInvalid.set(true),
    });
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
