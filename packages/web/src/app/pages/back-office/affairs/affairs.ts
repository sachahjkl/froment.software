import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
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
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';

type PageState = 'loading' | 'ready' | 'error';
type AffairTab = 'attention' | 'active' | 'completed' | 'all';
type AffairStage =
  | 'draft'
  | 'sent'
  | 'rejected'
  | 'expired'
  | 'archived'
  | 'cancelled'
  | 'ordered'
  | 'invoiceDraft'
  | 'issued'
  | 'paid'
  | 'void';

interface Affair {
  readonly quote: QuoteSummaryValue;
  readonly order: OrderSummaryValue | undefined;
  readonly invoice: InvoiceSummaryValue | undefined;
  readonly stage: AffairStage;
}

@Component({
  selector: 'app-affairs',
  imports: [Badge, Button, DataTable, Notice, RouterLink, RouterOutlet, TabLayout, TabPanel, Tabs],
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
  protected readonly state = signal<PageState>('loading');
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  private readonly clients = signal<ClientListValue>([]);
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
      return { quote, order, invoice, stage: this.stage(quote, order, invoice, clientArchived) };
    }),
  );
  protected visibleAffairs(tab: AffairTab): readonly Affair[] {
    if (tab === 'all') return this.affairs();
    if (tab === 'completed') {
      return this.affairs().filter(({ stage }) =>
        ['paid', 'void', 'rejected', 'expired', 'archived', 'cancelled'].includes(stage),
      );
    }
    if (tab === 'attention') {
      return this.affairs().filter(({ stage }) =>
        ['draft', 'ordered', 'invoiceDraft', 'issued'].includes(stage),
      );
    }
    return this.affairs().filter(
      ({ stage }) =>
        !['paid', 'void', 'rejected', 'expired', 'archived', 'cancelled'].includes(stage),
    );
  }

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
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
    this.state.set('loading');
    try {
      const [quotes, orders, invoices, clients] = await Promise.all([
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
        this.clientsApi.list(),
      ]);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.clients.set(clients);
      this.state.set('ready');
    } catch {
      this.state.set('error');
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
