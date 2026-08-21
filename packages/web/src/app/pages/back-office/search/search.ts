import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';

interface SearchResult {
  readonly id: string;
  readonly kind: 'client' | 'quote' | 'order' | 'invoice';
  readonly reference: string;
  readonly detail: string;
  readonly search: string;
  readonly link: readonly string[];
}

@Component({
  selector: 'app-search',
  imports: [BackOfficeNav, Badge, Button, DataTable, Notice, RouterLink],
  templateUrl: './search.html',
  styleUrl: './search.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Search {
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clientsApi = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly query = signal('');
  private readonly items = signal<readonly SearchResult[]>([]);
  protected readonly results = computed(() => {
    const terms = this.query().trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    return this.items()
      .filter((item) => terms.every((term) => item.search.includes(term)))
      .slice(0, 50);
  });

  constructor() {
    this.query.set(this.route.snapshot.queryParamMap.get('query') ?? '');
    afterNextRender(() => void this.load());
  }

  protected updateQuery(input: HTMLInputElement): void {
    this.query.set(input.value.slice(0, 120));
  }

  protected kindLabel(kind: SearchResult['kind']): string {
    return this.i18n.t(`backOffice.search.kind.${kind}`);
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    void this.router.navigate([], {
      queryParams: { query: this.query().trim() || null },
      replaceUrl: true,
    });
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [clients, quotes, orders, invoices] = await Promise.all([
        this.clientsApi.list(),
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
      ]);
      this.items.set([
        ...clients.map((client) => ({
          id: client.id,
          kind: 'client' as const,
          reference: client.displayName,
          detail: client.email,
          search: `${client.displayName} ${client.email}`.toLocaleLowerCase(),
          link: ['/backoffice/clients', client.id] as const,
        })),
        ...quotes.map((quote) => ({
          id: quote.id,
          kind: 'quote' as const,
          reference: quote.reference,
          detail: `${quote.clientDisplayName} · ${quote.title}`,
          search:
            `${quote.reference} ${quote.clientDisplayName} ${quote.title}`.toLocaleLowerCase(),
          link: ['/backoffice/affaires', quote.id] as const,
        })),
        ...orders.map((order) => ({
          id: order.id,
          kind: 'order' as const,
          reference: order.reference,
          detail: `${order.clientDisplayName} · ${order.title}`,
          search:
            `${order.reference} ${order.quoteReference} ${order.clientDisplayName} ${order.title}`.toLocaleLowerCase(),
          link: ['/backoffice/affaires', order.quoteId] as const,
        })),
        ...invoices.map((invoice) => ({
          id: invoice.id,
          kind: 'invoice' as const,
          reference: invoice.invoiceNumber ?? invoice.orderReference,
          detail: `${invoice.clientDisplayName} · ${invoice.title}`,
          search:
            `${invoice.invoiceNumber ?? ''} ${invoice.orderReference} ${invoice.clientDisplayName} ${invoice.title}`.toLocaleLowerCase(),
          link: ['/backoffice/invoices', invoice.id] as const,
        })),
      ]);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
