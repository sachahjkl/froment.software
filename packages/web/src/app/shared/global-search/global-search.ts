import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { _IdGenerator } from '@angular/cdk/a11y';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

interface SearchItem {
  readonly id: string;
  readonly kind: 'client' | 'quote' | 'order' | 'invoice';
  readonly reference: string;
  readonly detail: string;
  readonly aliases: string;
  readonly link: readonly string[];
}

@Component({
  selector: 'app-global-search',
  imports: [Button, FormField, RouterLink, SearchHighlight],
  providers: [SearchHighlightRegistry],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss',
  host: { '(keydown.escape)': 'escape($event)', '(focusout)': 'leave($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalSearch {
  protected readonly id = inject(_IdGenerator).getId('global-search-');
  protected readonly i18n = inject(I18nService);
  private readonly clientsApi = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly opened = signal(false);
  protected readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly searchForm = form(signal({ query: '' }), (path) => maxLength(path.query, 120));
  private readonly items = signal<readonly SearchItem[]>([]);
  private readonly results = createFuzzySearch(
    this.items,
    computed(() => this.searchForm.query().value()),
    {
      keys: [
        { name: 'reference', weight: 0.55 },
        { name: 'detail', weight: 0.35 },
        { name: 'aliases', weight: 0.1 },
      ],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly groups = computed(() => {
    if (!this.searchForm.query().value().trim()) return [];
    return (['client', 'quote', 'order', 'invoice'] as const)
      .map((kind) => ({
        kind,
        label: this.i18n.t(`backOffice.search.kind.${kind}`),
        results: this.results()
          .filter(({ item }) => item.kind === kind)
          .slice(0, 5)
          .map(({ item, matches }) => ({
            ...item,
            referenceMatches: matches?.find(({ key }) => key === 'reference')?.indices ?? [],
            detailMatches: matches?.find(({ key }) => key === 'detail')?.indices ?? [],
          })),
      }))
      .filter(({ results }) => results.length > 0);
  });
  protected readonly displayedCount = computed(() =>
    this.groups().reduce((count, group) => count + group.results.length, 0),
  );

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.opened.set(false);
    });
  }

  protected open(): void {
    if (this.opened()) return;
    this.opened.set(true);
    void this.load();
  }

  protected close(): void {
    this.searchForm.query().focusBoundControl();
    this.opened.set(false);
  }

  protected escape(event: Event): void {
    // Prevent the native search clear action from reopening the panel through an input event.
    event.preventDefault();
    this.close();
  }

  protected retry(): void {
    // Keep focus inside the search before loading removes the retry button.
    this.searchForm.query().focusBoundControl();
    void this.load();
  }

  protected leave(event: FocusEvent): void {
    if (this.router.currentNavigation()) return;
    if (
      !(event.relatedTarget instanceof Node) ||
      !this.host.nativeElement.contains(event.relatedTarget)
    )
      this.opened.set(false);
  }

  protected async load(): Promise<void> {
    if (this.state() === 'loading') return;
    this.state.set('loading');
    try {
      const [clients, quotes, orders, invoices] = await Promise.all([
        this.clientsApi.list(),
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
      ]);
      if (this.destroyRef.destroyed) return;
      this.items.set([
        ...clients.map((client) => ({
          id: client.id,
          kind: 'client' as const,
          reference: client.displayName,
          detail: client.email,
          aliases: `${client.city} ${client.country}`,
          link: ['/backoffice/clients', client.id],
        })),
        ...quotes.map((quote) => ({
          id: quote.id,
          kind: 'quote' as const,
          reference: quote.reference,
          detail: `${quote.clientDisplayName} · ${quote.title}`,
          aliases: '',
          link: ['/backoffice/quotes', quote.id],
        })),
        ...orders.map((order) => ({
          id: order.id,
          kind: 'order' as const,
          reference: order.reference,
          detail: `${order.clientDisplayName} · ${order.title}`,
          aliases: order.quoteReference,
          link: ['/backoffice/orders', order.id],
        })),
        ...invoices.map((invoice) => ({
          id: invoice.id,
          kind: 'invoice' as const,
          reference: invoice.invoiceNumber ?? invoice.orderReference,
          detail: `${invoice.clientDisplayName} · ${invoice.title}`,
          aliases: invoice.orderReference,
          link: ['/backoffice/invoices', invoice.id],
        })),
      ]);
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed) this.state.set('error');
    }
  }
}
