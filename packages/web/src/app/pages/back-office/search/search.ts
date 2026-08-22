import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type FuseResultMatch } from 'fuse.js';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createFuzzySearch } from '@shared/fuzzy-search';

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
  selector: 'app-search',
  imports: [BackOfficeNav, Badge, Button, Notice, RouterLink, ScrollingModule, SearchHighlight],
  providers: [SearchHighlightRegistry],
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
  private readonly items = signal<readonly SearchItem[]>([]);
  private readonly searchResults = createFuzzySearch(this.items, this.query, {
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
  protected readonly results = computed(() =>
    this.searchResults().map(({ item, matches = [] }) => ({
      ...item,
      referenceMatches: matches.find(({ key }) => key === 'reference')?.indices ?? noMatches,
      detailMatches: matches.find(({ key }) => key === 'detail')?.indices ?? noMatches,
    })),
  );

  constructor() {
    this.query.set(this.route.snapshot.queryParamMap.get('query') ?? '');
    afterNextRender(() => void this.load());
  }

  protected updateQuery(input: HTMLInputElement): void {
    this.query.set(input.value.slice(0, 120));
  }

  protected kindLabel(kind: SearchItem['kind']): string {
    return this.i18n.t(`backOffice.search.kind.${kind}`);
  }

  protected readonly resultTrackBy = (_index: number, result: SearchResult): string =>
    `${result.kind}-${result.id}`;

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
          aliases: '',
          link: ['/backoffice/clients', client.id] as const,
        })),
        ...quotes.map((quote) => ({
          id: quote.id,
          kind: 'quote' as const,
          reference: quote.reference,
          detail: `${quote.clientDisplayName} · ${quote.title}`,
          aliases: '',
          link: ['/backoffice/affaires', quote.id] as const,
        })),
        ...orders.map((order) => ({
          id: order.id,
          kind: 'order' as const,
          reference: order.reference,
          detail: `${order.clientDisplayName} · ${order.title}`,
          aliases: order.quoteReference,
          link: ['/backoffice/affaires', order.quoteId] as const,
        })),
        ...invoices.map((invoice) => ({
          id: invoice.id,
          kind: 'invoice' as const,
          reference: invoice.invoiceNumber ?? invoice.orderReference,
          detail: `${invoice.clientDisplayName} · ${invoice.title}`,
          aliases: invoice.orderReference,
          link: ['/backoffice/invoices', invoice.id] as const,
        })),
      ]);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
