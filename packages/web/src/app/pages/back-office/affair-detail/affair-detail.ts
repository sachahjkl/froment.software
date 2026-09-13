import { Can } from '@backoffice/can';
import { AffairsApi } from '@backoffice/affairs-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import {
  AffairUpdateRequest,
  type Affair,
  type AuditEvent,
  type InvoiceListValue,
  type OrderListValue,
  type QuoteListValue,
  Ulid,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { I18nService } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { InlineEdit } from '@shared/inline-edit/inline-edit';

@Component({
  selector: 'app-affair-detail',
  host: { class: 'page-container' },
  imports: [
    Can,
    Badge,
    Button,
    DataTable,
    InlineEdit,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    Tabs,
    TabLayout,
    TabPanel,
  ],
  templateUrl: './affair-detail.html',
  styleUrl: './affair-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffairDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(AffairsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly affair = signal<typeof Affair.Type | undefined>(undefined);
  protected readonly quotes = signal<QuoteListValue>([]);
  protected readonly orders = signal<OrderListValue>([]);
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly events = signal<ReadonlyArray<typeof AuditEvent.Type>>([]);
  protected readonly editing = signal<'title' | 'status' | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly statusOptions = computed(() => [
    { value: 'open', label: this.i18n.t('affair.open') },
    { value: 'closed', label: this.i18n.t('affair.closed') },
  ]);
  protected readonly statusLabel = computed(() => {
    const status = this.affair()?.status;
    return status === undefined ? '' : this.i18n.t(`affair.${status}`);
  });
  protected readonly linkedQuotes = computed(() => {
    const ids = new Set(this.affair()?.quoteIds ?? []);
    return this.quotes().filter((quote) => ids.has(quote.id));
  });
  protected readonly linkedOrders = computed(() => {
    const ids = new Set(this.affair()?.orderIds ?? []);
    return this.orders().filter((order) => ids.has(order.id));
  });
  protected readonly linkedInvoices = computed(() => {
    const ids = new Set(this.affair()?.invoiceIds ?? []);
    return this.invoices().filter((invoice) => ids.has(invoice.id));
  });
  protected readonly tabs = computed<readonly TabItem[]>(() => [
    { path: 'overview', id: 'affair-overview-tab', label: this.i18n.t('commercial.summary') },
    { path: 'history', id: 'affair-history-tab', label: this.i18n.t('billingWorkspace.history') },
  ]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected async load(): Promise<void> {
    const id = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('affairId'));
    if (Option.isNone(id)) {
      this.state.set('error');
      return;
    }
    this.state.set('loading');
    try {
      const [affair, quotes, orders, invoices, events] = await Promise.all([
        this.api.get(id.value),
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
        this.api.events(id.value),
      ]);
      if (!affair.success) {
        this.state.set('error');
        return;
      }
      this.affair.set(affair.result);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.events.set(
        events.success
          ? events.result.toSorted((left, right) => left.occurredAt.localeCompare(right.occurredAt))
          : [],
      );
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async save(field: 'title' | 'status', value: string): Promise<void> {
    const affair = this.affair();
    if (!affair || this.saving() || (field === 'title' && value === '')) return;
    let status = affair.status;
    if (field === 'status') {
      if (value !== 'open' && value !== 'closed') return;
      status = value;
    }
    this.saving.set(true);
    try {
      const result = await this.api.update(
        affair.id,
        AffairUpdateRequest.make({
          expectedVersion: affair.version,
          title: field === 'title' ? value : affair.title,
          status,
        }),
      );
      if (result.success) {
        this.affair.set(result.result);
        this.editing.set(undefined);
      } else this.state.set('error');
    } finally {
      this.saving.set(false);
    }
  }
}
