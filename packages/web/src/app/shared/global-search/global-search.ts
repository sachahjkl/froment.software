import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormField, form, maxLength } from '@angular/forms/signals';
import { _IdGenerator } from '@angular/cdk/a11y';
import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import type { PermissionCodeValue } from '@froment/contracts';
import { Button } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

interface SearchItem {
  readonly id: string;
  readonly kind: 'action' | 'client' | 'quote' | 'order' | 'invoice';
  readonly reference: string;
  readonly detail: string;
  readonly aliases: string;
  readonly link: readonly string[];
}

interface SearchAction {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly aliases: string;
  readonly permissions: readonly PermissionCodeValue[];
  readonly link: readonly string[];
}

@Component({
  selector: 'app-global-search',
  imports: [Button, FormField, Icon, RouterLink, SearchHighlight],
  providers: [SearchHighlightRegistry],
  templateUrl: './global-search.html',
  styleUrl: './global-search.scss',
  host: { '(document:keydown)': 'shortcut($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalSearch {
  private readonly authentication = inject(Authentication);
  protected readonly available = computed(
    () =>
      this.authentication.account()?.mode === 'administrator' &&
      (this.authentication.can('client.read') ||
        this.authentication.can('quote.read') ||
        this.authentication.can('order.read') ||
        this.authentication.can('invoice.read') ||
        this.actions().length > 0),
  );
  readonly shortcutEnabled = input(false);
  protected readonly id = inject(_IdGenerator).getId('global-search-');
  protected readonly i18n = inject(I18nService);
  private readonly clientsApi = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dialogs = inject(Dialog);
  private readonly document = inject(DOCUMENT);
  private readonly content = viewChild.required<TemplateRef<unknown>>('content');
  private readonly trigger = viewChild.required('trigger', { read: ElementRef<HTMLButtonElement> });
  private dialog: DialogRef | undefined;
  protected readonly shortcutLabel = signal('Ctrl+K');
  protected readonly opened = signal(false);
  protected readonly dialogId = computed(() => (this.opened() ? `${this.id}-dialog` : null));
  protected readonly shortcutKeys = computed(() =>
    this.shortcutEnabled() ? ['Control+k', 'Meta+k'].join(' ') : null,
  );
  protected readonly state = linkedSignal<'idle' | 'loading' | 'ready' | 'error'>(() => {
    this.authentication.account();
    return 'idle';
  });
  protected readonly searchForm = form(signal({ query: '' }), (path) => maxLength(path.query, 120));
  private readonly items = linkedSignal<readonly SearchItem[]>(() => {
    this.authentication.account();
    return [];
  });
  private readonly actions = computed<readonly SearchAction[]>(() => {
    const actions = [
      {
        id: 'create-quote',
        label: this.i18n.t('globalSearch.action.createQuote'),
        detail: this.i18n.t('globalSearch.action.createQuoteDetail'),
        aliases: this.i18n.t('globalSearch.action.createQuoteAliases'),
        permissions: [
          'quote.create',
          'client.read',
          'catalog.read',
          'condition.read',
          'issuer.read',
        ],
        link: ['/backoffice/quotes/new'],
      },
      {
        id: 'create-client',
        label: this.i18n.t('globalSearch.action.createClient'),
        detail: this.i18n.t('globalSearch.action.createClientDetail'),
        aliases: this.i18n.t('globalSearch.action.createClientAliases'),
        permissions: ['client.create'],
        link: ['/backoffice/clients/new'],
      },
      {
        id: 'create-affair',
        label: this.i18n.t('globalSearch.action.createAffair'),
        detail: this.i18n.t('globalSearch.action.createAffairDetail'),
        aliases: this.i18n.t('globalSearch.action.createAffairAliases'),
        permissions: ['affair.create', 'affair.read', 'client.read'],
        link: ['/backoffice/affairs'],
      },
      {
        id: 'create-purchase',
        label: this.i18n.t('globalSearch.action.createPurchase'),
        detail: this.i18n.t('globalSearch.action.createPurchaseDetail'),
        aliases: this.i18n.t('globalSearch.action.createPurchaseAliases'),
        permissions: ['supplier-invoice.create'],
        link: ['/backoffice/purchases/new'],
      },
      {
        id: 'create-supplier',
        label: this.i18n.t('globalSearch.action.createSupplier'),
        detail: this.i18n.t('globalSearch.action.createSupplierDetail'),
        aliases: this.i18n.t('globalSearch.action.createSupplierAliases'),
        permissions: ['supplier.create'],
        link: ['/backoffice/suppliers/new'],
      },
      {
        id: 'create-catalog-item',
        label: this.i18n.t('globalSearch.action.createCatalogItem'),
        detail: this.i18n.t('globalSearch.action.createCatalogItemDetail'),
        aliases: this.i18n.t('globalSearch.action.createCatalogItemAliases'),
        permissions: ['catalog.manage'],
        link: ['/backoffice/catalog/new'],
      },
      {
        id: 'compose-email',
        label: this.i18n.t('globalSearch.action.composeEmail'),
        detail: this.i18n.t('globalSearch.action.composeEmailDetail'),
        aliases: this.i18n.t('globalSearch.action.composeEmailAliases'),
        permissions: ['email.draft.manage'],
        link: ['/backoffice/emails/new'],
      },
    ] satisfies readonly SearchAction[];
    return actions.filter((action) =>
      action.permissions.every((permission) => this.authentication.can(permission)),
    );
  });
  private readonly searchItems = computed<readonly SearchItem[]>(() => [
    ...this.actions().map((action) => ({
      id: action.id,
      kind: 'action' as const,
      reference: action.label,
      detail: action.detail,
      aliases: action.aliases,
      link: action.link,
    })),
    ...this.items(),
  ]);
  private readonly results = createFuzzySearch(
    this.searchItems,
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
    return (['action', 'client', 'quote', 'order', 'invoice'] as const)
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
    this.destroyRef.onDestroy(() => this.dialog?.close());
    afterNextRender(() => {
      if (
        /Macintosh|Mac OS X|iPhone|iPad|iPod/.test(
          this.document.defaultView?.navigator.userAgent ?? '',
        )
      )
        this.shortcutLabel.set('Cmd+K');
    });
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) this.close();
    });
  }

  protected open(): void {
    if (this.dialog || !this.available()) return;
    const dialog = this.dialogs.open(this.content(), {
      id: `${this.id}-dialog`,
      ariaLabelledBy: `${this.id}-heading`,
      ariaModal: true,
      autoFocus: 'input[type="search"]',
      restoreFocus: this.trigger().nativeElement,
      closeOnNavigation: false,
      disableAnimations: true,
      width: '38rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.dialog = dialog;
    this.opened.set(true);
    dialog.closed.subscribe(() => {
      this.dialog = undefined;
      if (!this.destroyRef.destroyed) this.opened.set(false);
    });
    void this.load();
  }

  protected close(): void {
    this.dialog?.close();
  }

  protected shortcut(event: KeyboardEvent): void {
    if (
      !this.shortcutEnabled() ||
      !this.available() ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.shiftKey ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'k'
    )
      return;
    // Ne déplacez pas le focus derrière une confirmation d’abandon ou une autre modale.
    const activeDialog = this.dialogs.openDialogs.at(-1);
    if (activeDialog && activeDialog !== this.dialog) return;
    event.preventDefault();
    if (this.dialog) this.searchForm.query().focusBoundControl();
    else this.open();
  }

  protected retry(): void {
    // Keep focus inside the search before loading removes the retry button.
    this.searchForm.query().focusBoundControl();
    void this.load();
  }

  protected async load(): Promise<void> {
    const account = this.authentication.account();
    if (this.state() === 'loading' || account === undefined || !this.available()) return;
    this.state.set('loading');
    try {
      const [clients, quotes, orders, invoices] = await Promise.all([
        this.authentication.can('client.read') ? this.clientsApi.list() : [],
        this.authentication.can('quote.read') ? this.quotesApi.list() : [],
        this.authentication.can('order.read') ? this.ordersApi.list() : [],
        this.authentication.can('invoice.read') ? this.invoicesApi.list() : [],
      ]);
      if (this.destroyRef.destroyed || this.authentication.account() !== account) return;
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
      if (!this.destroyRef.destroyed && this.authentication.account() === account)
        this.state.set('error');
    }
  }
}
