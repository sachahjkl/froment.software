import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type ClientSummaryValue,
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { type FuseResultMatch } from 'fuse.js';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

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
  readonly link: readonly string[];
}

interface SearchItem {
  readonly id: string;
  readonly kind: 'client' | 'quote' | 'order' | 'invoice';
  readonly reference: string;
  readonly detail: string;
  readonly aliases: string;
  readonly link: readonly string[];
}

interface SearchResult extends SearchItem {
  readonly referenceMatches: FuseResultMatch['indices'];
  readonly detailMatches: FuseResultMatch['indices'];
}

const noMatches: FuseResultMatch['indices'] = [];

@Component({
  selector: 'app-dashboard',
  imports: [Badge, Button, Notice, RouterLink, ScrollingModule, SearchHighlight],
  providers: [SearchHighlightRegistry],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly i18n = inject(I18nService);
  private readonly quotesApi = inject(QuotesApi);
  private readonly clientsApi = inject(ClientsApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  protected readonly state = signal<PageState>('loading');
  protected readonly query = signal('');
  private readonly clients = signal<ReadonlyArray<ClientSummaryValue>>([]);
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  private readonly searchItems = computed<readonly SearchItem[]>(() => [
    ...this.clients().map((client) => ({
      id: client.id,
      kind: 'client' as const,
      reference: client.displayName,
      detail: client.email,
      aliases: '',
      link: ['/backoffice/clients', client.id] as const,
    })),
    ...this.quotes().map((quote) => ({
      id: quote.id,
      kind: 'quote' as const,
      reference: quote.reference,
      detail: `${quote.clientDisplayName} · ${quote.title}`,
      aliases: '',
      link: ['/backoffice/affaires', quote.id] as const,
    })),
    ...this.orders().map((order) => ({
      id: order.id,
      kind: 'order' as const,
      reference: order.reference,
      detail: `${order.clientDisplayName} · ${order.title}`,
      aliases: order.quoteReference,
      link: ['/backoffice/affaires', order.quoteId] as const,
    })),
    ...this.invoices().map((invoice) => ({
      id: invoice.id,
      kind: 'invoice' as const,
      reference: invoice.invoiceNumber ?? invoice.orderReference,
      detail: `${invoice.clientDisplayName} · ${invoice.title}`,
      aliases: invoice.orderReference,
      link: ['/backoffice/invoices', invoice.id] as const,
    })),
  ]);
  private readonly fuzzyResults = createFuzzySearch(this.searchItems, this.query, {
    keys: [
      { name: 'reference', weight: 0.55 },
      { name: 'detail', weight: 0.35 },
      { name: 'aliases', weight: 0.1 },
    ],
    findAllMatches: true,
    ignoreDiacritics: true,
    ignoreLocation: true,
    includeMatches: true,
    threshold: 0.35,
  });
  protected readonly searchResults = computed<readonly SearchResult[]>(() => {
    if (this.query().trim() === '') return [];
    return this.fuzzyResults().map(({ item, matches = [] }) => ({
      ...item,
      referenceMatches: matches.find(({ key }) => key === 'reference')?.indices ?? noMatches,
      detailMatches: matches.find(({ key }) => key === 'detail')?.indices ?? noMatches,
    }));
  });
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
      .reduce((total, invoice) => total + invoice.totalCents - invoice.recordedPaidCents, 0),
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
        link: ['/backoffice/affaires', quote.id] as const,
      })),
      ...this.invoices().map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: invoice.invoiceNumber ?? invoice.orderReference,
        client: invoice.clientDisplayName,
        date: invoice.updatedAt,
        link: ['/backoffice/invoices', invoice.id] as const,
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

  protected updateQuery(input: HTMLInputElement): void {
    this.query.set(input.value.slice(0, 120));
  }

  protected kindLabel(kind: SearchItem['kind']): string {
    return this.i18n.t(`backOffice.search.kind.${kind}`);
  }

  protected readonly resultTrackBy = (_index: number, result: SearchResult): string =>
    `${result.kind}-${result.id}`;

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [clients, quotes, orders, invoices] = await Promise.all([
        this.clientsApi.list(),
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
      ]);
      this.clients.set(clients);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
