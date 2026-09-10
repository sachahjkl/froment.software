import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  Ulid,
  type ClientAccessValue,
  type ClientSummaryValue,
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientsApi, type ClientErrorCode } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { ActionMenu } from '@shared/action-menu/action-menu';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { PageHeader } from '@shared/page-header/page-header';
import { EmptyState } from '@shared/empty-state/empty-state';
import { clientFilters, clientFilterQuery, clientView } from '../clients/client-filters';

interface ClientDocument {
  readonly id: string;
  readonly kind: string;
  readonly reference: string;
  readonly title: string;
  readonly status: string;
  readonly totalCents: number;
  readonly link: readonly string[];
  readonly updatedAt: string;
}

@Component({
  host: { class: 'page-container' },
  selector: 'app-client-detail',
  imports: [
    ActionMenu,
    Badge,
    Button,
    DataTable,
    Notice,
    RouterLink,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    PageHeader,
    EmptyState,
  ],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetail {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly backLink = computed(() => [
    '/backoffice/clients',
    clientView(this.queryParams().get('view')),
  ]);
  protected readonly returnQuery = computed(() =>
    clientFilterQuery(clientFilters(this.queryParams())),
  );
  private loadGeneration = 0;
  protected readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly archiving = signal(false);
  protected readonly documentsError = signal(false);
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['profile', 'affairs', 'documents', 'access'] as const).map((value) => ({
      path: value,
      id: `client-${value}-tab`,
      label: this.i18n.t(
        value === 'affairs' ? 'clientsWorkspace.affairs' : `backOffice.clientDetail.tab.${value}`,
      ),
    })),
  );
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  protected readonly affairs = computed(() =>
    this.quotes().filter(({ clientId }) => clientId === this.client()?.id),
  );
  protected readonly documentsLoading = signal(true);
  protected readonly documents = computed<readonly ClientDocument[]>(() => {
    const id = this.client()?.id;
    if (!id) return [];
    return [
      ...this.quotes()
        .filter(({ clientId }) => clientId === id)
        .map((quote) => ({
          id: `quote-${quote.id}`,
          kind: this.i18n.t('backOffice.clientDetail.quote'),
          reference: quote.reference,
          title: quote.title,
          status: this.i18n.t(`backOffice.quote.status.${quote.status}`),
          totalCents: quote.totalCents,
          link: ['/backoffice/quotes', quote.id] as const,
          updatedAt: quote.updatedAt,
        })),
      ...this.orders()
        .filter(({ clientId }) => clientId === id)
        .map((order) => ({
          id: `order-${order.id}`,
          kind: this.i18n.t('backOffice.clientDetail.order'),
          reference: order.reference,
          title: order.title,
          status: this.i18n.t('backOffice.clientDetail.confirmed'),
          totalCents: order.totalCents,
          link: ['/backoffice/orders', order.id] as const,
          updatedAt: order.createdAt,
        })),
      ...this.invoices()
        .filter(({ clientId }) => clientId === id)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          kind: this.i18n.t('backOffice.clientDetail.invoice'),
          reference: invoice.invoiceNumber ?? invoice.orderReference,
          title: invoice.title,
          status: this.i18n.t(`backOffice.invoice.status.${invoice.status}`),
          totalCents: invoice.totalCents,
          link: ['/backoffice/invoices', invoice.id] as const,
          updatedAt: invoice.updatedAt,
        })),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  });
  protected readonly accessesLoading = signal(true);
  protected readonly accesses = signal<ReadonlyArray<ClientAccessValue>>([]);
  protected readonly revokingAccessId = signal<string | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly reactivating = signal(false);
  protected readonly archived = computed(() => this.client()?.archived ?? false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  async canDeactivate(): Promise<boolean> {
    return !this.revokingAccessId() && !this.archiving() && !this.reactivating();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.revokingAccessId() || this.archiving() || this.reactivating()) event.preventDefault();
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected quoteStatus(status: QuoteSummaryValue['status']): string {
    return this.i18n.t(`backOffice.quote.status.${status}`);
  }

  protected formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'medium' }).format(timestamp);
  }

  protected async revokeAccess(access: ClientAccessValue): Promise<void> {
    const client = this.client();
    if (
      client === undefined ||
      this.revokingAccessId() !== undefined ||
      !(await this.confirmation.request(
        this.i18n.tf('backOffice.clientDetail.accessRevokeConfirmation', {
          email: access.email,
        }),
      ))
    ) {
      return;
    }
    this.revokingAccessId.set(access.id);
    this.error.set(undefined);
    const outcome = await this.api.revokeAccess(client.id, access.id);
    this.revokingAccessId.set(undefined);
    if (!outcome.success) {
      this.setError(outcome.code);
      return;
    }
    this.accesses.update((accesses) => accesses.filter(({ id }) => id !== access.id));
  }

  protected async reactivate(): Promise<void> {
    const client = this.client();
    if (!client?.archived || this.reactivating()) return;
    this.reactivating.set(true);
    this.error.set(undefined);
    const outcome = await this.api.reactivate(client.id);
    this.reactivating.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.client.set(outcome.result);
    void this.router.navigate(['access'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }

  protected async archive(): Promise<void> {
    const current = this.client();
    if (!current || current.archived || this.archiving()) return;
    if (
      !(await this.confirmation.request(this.i18n.t('backOffice.clients.archiveConfirmation'), {
        variant: 'danger',
      }))
    )
      return;
    this.archiving.set(true);
    this.error.set(undefined);
    const outcome = await this.api.archive(current.id);
    this.archiving.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.client.set(outcome.result);
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.client.set(undefined);
    this.documentsLoading.set(true);
    this.documentsError.set(false);
    this.quotes.set([]);
    this.orders.set([]);
    this.invoices.set([]);
    this.accesses.set([]);
    this.accessesLoading.set(true);
    this.error.set(undefined);
    const clientId = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('clientId'));
    if (Option.isNone(clientId)) {
      this.error.set('client.not_found');
      this.loading.set(false);
      return;
    }
    const outcome = await this.api.get(clientId.value);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (!outcome.success) {
      this.setError(outcome.code);
      this.loading.set(false);
      return;
    }
    this.client.set(outcome.result);
    this.loading.set(false);
    const [quotes, orders, invoices, accesses] = await Promise.allSettled([
      this.quotesApi.list(),
      this.ordersApi.list(),
      this.invoicesApi.list(),
      this.api.listAccess(clientId.value),
    ]);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (quotes.status === 'fulfilled') this.quotes.set(quotes.value);
    if (orders.status === 'fulfilled') this.orders.set(orders.value);
    if (invoices.status === 'fulfilled') this.invoices.set(invoices.value);
    if (accesses.status === 'fulfilled') {
      if (accesses.value.success) this.accesses.set(accesses.value.result);
      else this.setError(accesses.value.code);
    } else {
      this.error.set('client.error');
    }
    this.accessesLoading.set(false);
    this.documentsError.set([quotes, orders, invoices].some(({ status }) => status === 'rejected'));
    this.documentsLoading.set(false);
  }

  private setError(code: ClientErrorCode): void {
    this.error.set(code);
  }
}
import { formatMoney } from '@froment/l10n';
