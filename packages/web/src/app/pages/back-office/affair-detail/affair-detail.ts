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
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import {
  AffairQuoteLinkRequest,
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

@Component({
  selector: 'app-affair-detail',
  host: { class: 'page-container' },
  imports: [
    Can,
    Badge,
    Button,
    DataTable,
    FormField,
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
  protected readonly selectedQuoteId = signal('');
  private readonly model = signal<{ title: string; status: 'open' | 'closed' }>({
    title: '',
    status: 'open',
  });
  protected readonly editForm = form(this.model, (path) => {
    required(path.title);
    maxLength(path.title, 160);
  });
  protected readonly saving = signal(false);
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
  protected readonly availableQuotes = computed(() => {
    const affair = this.affair();
    const linked = new Set(affair?.quoteIds ?? []);
    return affair
      ? this.quotes().filter((quote) => quote.clientId === affair.clientId && !linked.has(quote.id))
      : [];
  });
  protected readonly tabs = computed<readonly TabItem[]>(() => [
    { path: 'overview', id: 'affair-overview-tab', label: this.i18n.t('commercial.summary') },
    { path: 'documents', id: 'affair-documents-tab', label: this.i18n.t('affair.documents') },
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
      this.editForm().reset({ title: affair.result.title, status: affair.result.status });
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const affair = this.affair();
    if (!affair || this.editForm().invalid() || this.saving()) return;
    this.saving.set(true);
    try {
      const value = this.model();
      const result = await this.api.update(
        affair.id,
        AffairUpdateRequest.make({
          expectedVersion: affair.version,
          title: value.title.trim(),
          status: value.status,
        }),
      );
      if (result.success) {
        this.affair.set(result.result);
        this.editForm().reset({ title: result.result.title, status: result.result.status });
      } else this.state.set('error');
    } finally {
      this.saving.set(false);
    }
  }

  protected async linkQuote(): Promise<void> {
    const affair = this.affair();
    if (!affair || !this.selectedQuoteId() || this.saving()) return;
    this.saving.set(true);
    try {
      const result = await this.api.linkQuote(
        affair.id,
        AffairQuoteLinkRequest.make({
          expectedVersion: affair.version,
          quoteId: Schema.decodeUnknownSync(Ulid)(this.selectedQuoteId()),
        }),
      );
      if (result.success) {
        this.affair.set(result.result);
        this.selectedQuoteId.set('');
      } else this.state.set('error');
    } finally {
      this.saving.set(false);
    }
  }
}
