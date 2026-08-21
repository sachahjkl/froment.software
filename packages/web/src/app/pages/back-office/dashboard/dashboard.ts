import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';

type PageState = 'loading' | 'ready' | 'error';

interface DashboardAction {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly client: string;
  readonly link: readonly string[];
  readonly variant: BadgeVariant;
  readonly priority: number;
}

interface ActivityItem {
  readonly id: string;
  readonly title: string;
  readonly client: string;
  readonly date: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [BackOfficeNav, Badge, Button, Notice, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  protected readonly state = signal<PageState>('loading');
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  protected readonly draftQuotes = computed(
    () => this.quotes().filter(({ status }) => status === 'draft').length,
  );
  protected readonly sentQuotes = computed(
    () => this.quotes().filter(({ status }) => status === 'sent').length,
  );
  protected readonly ordersToInvoice = computed(
    () => this.orders().filter(({ invoiceId }) => invoiceId === null).length,
  );
  protected readonly outstandingCents = computed(() =>
    this.invoices()
      .filter(({ status }) => status === 'issued')
      .reduce((total, invoice) => total + invoice.totalCents, 0),
  );
  protected readonly overdueInvoices = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.invoices().filter(({ status, dueDate }) => status === 'issued' && dueDate < today)
      .length;
  });
  protected readonly actions = computed<readonly DashboardAction[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [
      ...this.quotes()
        .filter(({ status }) => status === 'draft' || status === 'sent')
        .map((quote) => ({
          id: `quote-${quote.id}`,
          label:
            quote.status === 'sent'
              ? this.i18n.t('backOffice.affairs.stage.sent')
              : this.i18n.t('backOffice.affairs.stage.draft'),
          title: quote.title,
          client: quote.clientDisplayName,
          link: ['/backoffice/affaires', quote.id] as const,
          variant: quote.status === 'sent' ? ('warning' as const) : ('default' as const),
          priority: quote.status === 'sent' ? 2 : 4,
        })),
      ...this.orders()
        .filter(({ invoiceId }) => invoiceId === null)
        .map((order) => ({
          id: `order-${order.id}`,
          label: this.i18n.t('backOffice.affairs.stage.ordered'),
          title: order.title,
          client: order.clientDisplayName,
          link: ['/backoffice/affaires', order.quoteId] as const,
          variant: 'warning' as const,
          priority: 3,
        })),
      ...this.invoices()
        .filter(({ status }) => status === 'draft' || status === 'issued')
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          label:
            invoice.status === 'draft'
              ? this.i18n.t('backOffice.affairs.stage.invoiceDraft')
              : invoice.dueDate < today
                ? this.i18n.t('backOffice.dashboard.overdue')
                : this.i18n.t('backOffice.affairs.stage.issued'),
          title: invoice.title,
          client: invoice.clientDisplayName,
          link: ['/backoffice/invoices', invoice.id] as const,
          variant:
            invoice.status === 'issued' && invoice.dueDate < today
              ? ('danger' as const)
              : invoice.status === 'issued'
                ? ('warning' as const)
                : ('default' as const),
          priority:
            invoice.status === 'issued' && invoice.dueDate < today
              ? 1
              : invoice.status === 'issued'
                ? 2
                : 4,
        })),
    ]
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 12);
  });
  protected readonly activity = computed<readonly ActivityItem[]>(() =>
    [
      ...this.quotes().map((quote) => ({
        id: `quote-${quote.id}`,
        title: quote.reference,
        client: quote.clientDisplayName,
        date: quote.updatedAt,
      })),
      ...this.invoices().map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: invoice.invoiceNumber ?? invoice.orderReference,
        client: invoice.clientDisplayName,
        date: invoice.updatedAt,
      })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'medium' }).format(
      new Date(value),
    );
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [quotes, orders, invoices] = await Promise.all([
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
      ]);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      void this.router.navigateByUrl('/backoffice/login?mode=admin');
    }
  }
}
