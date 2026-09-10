import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { disabled, form, required } from '@angular/forms/signals';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  type CheckoutConnection,
  type CheckoutOperation,
  type CheckoutRequest,
  type InvoiceSummary,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { CheckoutApi } from '@backoffice/checkout-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import {
  PendingProviderRequests,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ObjectPicker } from '@shared/object-picker/object-picker';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { providerTabs, providerTestParams } from '../connections/provider-navigation';
import { CheckoutHistory } from './checkout-history';
import { checkoutKeyLabel, checkoutStatusLabel, checkoutWebhookLabel } from './checkout-view';

@Component({
  host: { class: 'page-container' },
  imports: [RouterLink, Button, Notice, ObjectPicker, PageHeader, Tabs],
  providers: [CheckoutHistory],
  selector: 'app-checkout',
  styleUrl: './checkout.scss',
  templateUrl: './checkout.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(CheckoutApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = inject(PendingProviderRequests);
  private readonly route = inject(ActivatedRoute);
  protected readonly history = inject(CheckoutHistory);
  protected readonly completed = signal(false);
  private requestStore: PendingRequestStore<CheckoutRequest> | undefined;
  protected readonly recoveryReady = signal(false);
  protected readonly connection = signal<typeof CheckoutConnection.Type | undefined>(undefined);
  protected readonly invoices = signal<readonly InvoiceSummary[]>([]);
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly testParams = computed(() => providerTestParams('stripe', this.queryParams()));
  protected readonly tabs = computed(() => providerTabs('stripe', this.i18n, this.selected()));
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly pending = signal<CheckoutRequest | undefined>(undefined);
  protected readonly selected = signal<string | undefined>(undefined);
  protected readonly current = computed(() =>
    this.history.operations().find((operation) => operation.request.requestId === this.selected()),
  );
  protected readonly model = signal({ invoiceId: '' });
  protected readonly checkoutForm = form(this.model, (path) => {
    required(path.invoiceId);
    disabled(
      path.invoiceId,
      () =>
        this.saving() || !this.recoveryReady() || this.pending() !== undefined || this.completed(),
    );
  });
  protected readonly invoice = computed(() =>
    this.invoices().find((item) => item.id === this.model().invoiceId),
  );
  protected readonly invoiceOptions = computed(() =>
    this.invoices().map((item) => ({
      id: item.id,
      label: `${item.invoiceNumber} — ${item.clientDisplayName}`,
      detail: this.money(this.balance(item)),
    })),
  );
  protected readonly active = computed(() =>
    this.history
      .operations()
      .some(
        (item) =>
          item.request.invoiceId === this.model().invoiceId &&
          ['queued', 'creating', 'retrying', 'open'].includes(item.status),
      ),
  );
  protected readonly statusLabel = checkoutStatusLabel;
  protected readonly keyLabel = checkoutKeyLabel;
  protected readonly webhookLabel = checkoutWebhookLabel;
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.saving()) return 'checkout.saving';
    if (this.pending()) return 'checkout.retryRequest';
    return 'checkout.create';
  });
  private readonly progress = viewChild('progress', { read: ElementRef<HTMLElement> });
  private readonly invoiceInput = viewChild(ObjectPicker);

  constructor() {
    afterRenderEffect(() => {
      if (this.completed()) this.progress()?.nativeElement.focus();
    });
    afterNextRender(() => {
      void this.load();
      this.history
        .watch(() => this.saving())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((operations) => {
          this.reconcileRequest(operations);
        });
    });
  }
  private async restoreRequest(): Promise<void> {
    this.recoveryReady.set(false);
    try {
      this.requestStore = await this.requests.checkout();
      const request = this.requestStore.read();
      if (request !== undefined) {
        this.pending.set(request);
        this.model.set({ invoiceId: request.invoiceId });
        this.selected.set(request.requestId);
      }
      this.recoveryReady.set(true);
      this.reconcileRequest(this.history.operations());
    } catch {
      this.error.set('checkout.recoveryUnavailable');
    }
  }
  private reconcileRequest(operations: readonly CheckoutOperation[]): void {
    const pending = this.pending();
    if (
      pending === undefined ||
      !operations.some((item) => item.request.requestId === pending.requestId) ||
      !this.clearPending()
    )
      return;
    this.selected.set(pending.requestId);
    this.completed.set(true);
    this.checkoutForm().reset();
    this.error.set(undefined);
  }
  private clearPending(): boolean {
    try {
      if (this.requestStore === undefined) throw new Error('pending_request.storage_unavailable');
      this.requestStore.clear();
      this.pending.set(undefined);
      return true;
    } catch {
      this.error.set('checkout.recoveryUnavailable');
      return false;
    }
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.ready.set(false);
    this.error.set(undefined);
    this.history.refresh();
    if (!this.recoveryReady()) await this.restoreRequest();
    try {
      const [connection, invoices] = await Promise.all([
        this.api.connection(),
        this.invoicesApi.list(),
      ]);
      this.connection.set(connection);
      this.ready.set(true);
      this.invoices.set(
        invoices.filter(
          (item) =>
            item.status === 'issued' &&
            item.creditedCents === 0 &&
            this.balance(item) >= 50 &&
            this.balance(item) <= 99999999,
        ),
      );
    } catch {
      this.error.set('checkout.loadError');
    } finally {
      this.loading.set(false);
    }
  }
  protected balance(invoice: InvoiceSummary): number {
    return invoice.totalCents - invoice.recordedPaidCents;
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected chooseInvoice(id: string): void {
    if (this.saving() || this.pending() || this.completed() || !this.recoveryReady()) return;
    if (!this.invoices().some((invoice) => invoice.id === id)) return;
    this.model.set({ invoiceId: id });
    this.checkoutForm.invoiceId().markAsDirty();
  }
  protected async create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (
      this.saving() ||
      this.completed() ||
      this.loading() ||
      !this.ready() ||
      !this.recoveryReady() ||
      !this.connection()?.testKey
    )
      return;
    const invoice = this.invoice();
    if (this.pending() === undefined && (this.checkoutForm().invalid() || invoice === undefined)) {
      this.checkoutForm.invoiceId().markAsTouched();
      this.invoiceInput()?.focus();
      return;
    }
    if (this.pending() === undefined && this.active()) return;
    this.saving.set(true);
    this.history.invalidate();
    try {
      const request =
        this.pending() ??
        (invoice === undefined
          ? undefined
          : {
              requestId: crypto.randomUUID(),
              invoiceId: invoice.id,
              expectedVersion: invoice.version,
            });
      if (
        request === undefined ||
        !(await this.confirmation.request(this.i18n.t('checkout.confirm'), {
          acceptLabel: this.i18n.t('checkout.create'),
        }))
      )
        return;
      try {
        if (this.requestStore === undefined) throw new Error('pending_request.storage_unavailable');
        this.requestStore.write(request);
      } catch {
        this.error.set('checkout.recoveryUnavailable');
        return;
      }
      this.pending.set(request);
      this.error.set(undefined);
      const result = await this.api.create(request);
      if (!result.success) {
        this.error.set(result.code);
        if (result.code !== 'checkout.error') this.clearPending();
        return;
      }
      this.clearPending();
      this.history.record(result.result);
      this.selected.set(request.requestId);
      this.completed.set(true);
      this.checkoutForm().reset();
      this.history.refresh();
      this.progress()?.nativeElement.focus();
    } finally {
      this.history.invalidate();
      this.saving.set(false);
    }
  }
  canDeactivate(): boolean | Promise<boolean> {
    return (
      !this.saving() &&
      ((!this.checkoutForm().dirty() && this.pending() === undefined) ||
        this.confirmation.request(this.i18n.t('checkout.unsaved')))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.checkoutForm().dirty() || this.pending() !== undefined)
      event.preventDefault();
  }
}
