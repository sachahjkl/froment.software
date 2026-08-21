import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Ulid,
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
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TextCopy } from '@shared/text-copy';

type ClientTab = 'profile' | 'documents' | 'access';

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

const emptyClient = () => ({
  displayName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
});

@Component({
  selector: 'app-client-detail',
  imports: [Badge, Button, DataTable, FormField, Notice, RouterLink, Tabs],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly textCopy = inject(TextCopy);
  private readonly route = inject(ActivatedRoute);
  private readonly model = signal(emptyClient());
  private readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly selectedTab = signal<ClientTab>('profile');
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['profile', 'documents', 'access'] as const).map((value) => ({
      value,
      id: `client-${value}-tab`,
      label: this.i18n.t(`backOffice.clientDetail.tab.${value}`),
      panelId: `client-${value}-panel`,
    })),
  );
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
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
          link: ['/backoffice/affaires'] as const,
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
  protected readonly accessPending = signal(false);
  protected readonly accessIdentifier = signal<string | undefined>(undefined);
  protected readonly copied = signal(false);
  protected readonly clientForm = form(this.model, (path) => {
    required(path.displayName);
    pattern(path.displayName, /\S/);
    maxLength(path.displayName, 120);
    maxLength(path.addressLine1, 160);
    maxLength(path.addressLine2, 160);
    maxLength(path.postalCode, 32);
    maxLength(path.city, 120);
    maxLength(path.country, 120);
    maxLength(path.email, 254);
    pattern(path.email, /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    disabled(path, { when: () => this.archived() });
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly reactivating = signal(false);
  protected readonly saved = signal(false);
  protected readonly archived = computed(() => this.client()?.archived ?? false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saveDisabled = computed(
    () =>
      this.loading() ||
      this.saving() ||
      this.archived() ||
      this.clientForm().invalid() ||
      !this.clientForm().dirty(),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  canDeactivate(): boolean {
    return (
      !this.clientForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.clientDetail.unsavedChanges'))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.clientForm().dirty()) event.preventDefault();
  }

  protected invalid(field: keyof ReturnType<typeof emptyClient>): boolean {
    return this.clientForm[field]().touched() && this.clientForm[field]().invalid();
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected async createAccess(): Promise<void> {
    const client = this.client();
    if (!client) return;
    this.accessPending.set(true);
    this.error.set(undefined);
    const outcome = await this.api.createAccess(client.id);
    this.accessPending.set(false);
    if (!outcome.success) {
      this.setError(outcome.code);
      return;
    }
    this.accessIdentifier.set(outcome.result.accessIdentifier);
    this.copied.set(false);
  }

  protected async reactivate(): Promise<void> {
    const client = this.client();
    if (!client?.archived || this.reactivating()) return;
    this.reactivating.set(true);
    this.error.set(undefined);
    const outcome = await this.api.reactivate(client.id);
    this.reactivating.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.applyClient(outcome.result);
    this.selectedTab.set('access');
  }

  protected async copyAccess(): Promise<void> {
    const value = this.accessIdentifier();
    if (value && (await this.textCopy.copy(value))) this.copied.set(true);
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    const current = this.client();
    if (current === undefined || current.archived) return;
    void submit(this.clientForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      const outcome = await this.api.update(current.id, {
        ...this.model(),
        expectedUpdatedAt: current.updatedAt,
      });
      this.saving.set(false);
      if (!outcome.success) {
        this.setError(outcome.code);
        return;
      }
      this.applyClient(outcome.result);
      this.saved.set(true);
    });
  }

  private async load(): Promise<void> {
    const clientId = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('clientId'));
    if (Option.isNone(clientId)) {
      this.error.set('client.not_found');
      this.loading.set(false);
      return;
    }
    const outcome = await this.api.get(clientId.value);
    if (!outcome.success) {
      this.setError(outcome.code);
      this.loading.set(false);
      return;
    }
    this.applyClient(outcome.result);
    this.loading.set(false);
    const [quotes, orders, invoices] = await Promise.allSettled([
      this.quotesApi.list(),
      this.ordersApi.list(),
      this.invoicesApi.list(),
    ]);
    if (quotes.status === 'fulfilled') this.quotes.set(quotes.value);
    if (orders.status === 'fulfilled') this.orders.set(orders.value);
    if (invoices.status === 'fulfilled') this.invoices.set(invoices.value);
    if ([quotes, orders, invoices].every(({ status }) => status === 'rejected')) {
      this.error.set('client.error');
    }
    this.documentsLoading.set(false);
  }

  private applyClient(client: ClientSummaryValue): void {
    this.client.set(client);
    this.model.set({
      displayName: client.displayName,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      postalCode: client.postalCode,
      city: client.city,
      country: client.country,
      email: client.email,
    });
    this.clientForm().reset();
  }

  private setError(code: ClientErrorCode): void {
    this.error.set(code);
  }
}
