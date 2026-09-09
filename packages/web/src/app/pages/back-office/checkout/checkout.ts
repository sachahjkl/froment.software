import {
  afterNextRender,
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
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, filter, timer } from 'rxjs';
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
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  imports: [RouterLink, FormField, Button, Notice, DataTable, LocalizedDatePipe],
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
  private requestStore: PendingRequestStore<CheckoutRequest> | undefined;
  protected readonly recoveryReady = signal(false);
  protected readonly connection = signal<typeof CheckoutConnection.Type | undefined>(undefined);
  protected readonly invoices = signal<readonly InvoiceSummary[]>([]);
  protected readonly operations = signal<readonly CheckoutOperation[]>([]);
  protected readonly loading = signal(true);
  protected readonly ready = signal(false);
  protected readonly historyLoaded = signal(false);
  protected readonly saving = signal(false);
  protected readonly paused = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly pending = signal<CheckoutRequest | undefined>(undefined);
  protected readonly selected = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('request') ?? '',
  );
  protected readonly current = computed(() =>
    this.selected() === ''
      ? this.operations()[0]
      : this.operations().find((operation) => operation.request.requestId === this.selected()),
  );
  protected readonly model = signal({ invoiceId: '' });
  protected readonly checkoutForm = form(this.model, (path) => {
    required(path.invoiceId);
    disabled(
      path.invoiceId,
      () => this.saving() || !this.recoveryReady() || this.pending() !== undefined,
    );
  });
  protected readonly invoice = computed(() =>
    this.invoices().find((item) => item.id === this.model().invoiceId),
  );
  protected readonly active = computed(() =>
    this.operations().some(
      (item) =>
        item.request.invoiceId === this.model().invoiceId &&
        ['queued', 'creating', 'retrying', 'open'].includes(item.status),
    ),
  );
  protected readonly labels = {
    queued: 'checkout.queued',
    creating: 'checkout.creating',
    retrying: 'checkout.retrying',
    open: 'checkout.open',
    paid: 'checkout.paid',
    expired: 'checkout.expired',
    failed: 'checkout.failed',
    blocked: 'checkout.blocked',
  } satisfies Record<CheckoutOperation['status'], TranslationKey>;
  private readonly progress = viewChild('progress', { read: ElementRef<HTMLElement> });
  private readonly invoiceInput = viewChild('invoiceInput', {
    read: ElementRef<HTMLSelectElement>,
  });
  private writeVersion = 0;

  constructor() {
    afterNextRender(() => {
      void this.load();
      timer(0, 3000)
        .pipe(
          filter(() => !this.paused() && !this.saving() && document.visibilityState === 'visible'),
          exhaustMap(() => {
            const version = this.writeVersion;
            return this.api.list().pipe(
              filter(() => version === this.writeVersion),
              catchError(() => {
                if (version === this.writeVersion) this.paused.set(true);
                return EMPTY;
              }),
            );
          }),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((operations) => {
          this.operations.set(operations);
          this.historyLoaded.set(true);
          const pending = this.pending();
          if (
            pending !== undefined &&
            operations.some((item) => item.request.requestId === pending.requestId)
          ) {
            if (!this.clearPending()) return;
            this.selected.set(pending.requestId);
            this.checkoutForm().reset();
            this.error.set(undefined);
          }
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
    } catch {
      this.error.set('checkout.recoveryUnavailable');
    }
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
    this.paused.set(false);
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
  protected select(operation: CheckoutOperation): void {
    this.selected.set(operation.request.requestId);
    this.progress()?.nativeElement.focus();
  }
  protected canOpen(operation: CheckoutOperation | undefined): boolean {
    return (
      operation !== undefined &&
      operation.status === 'open' &&
      operation.checkoutUrl !== null &&
      Date.parse(operation.expiresAt) > Date.now()
    );
  }
  protected async create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (
      this.saving() ||
      this.loading() ||
      !this.ready() ||
      !this.recoveryReady() ||
      !this.connection()?.testKey
    )
      return;
    const invoice = this.invoice();
    if (this.pending() === undefined && (this.checkoutForm().invalid() || invoice === undefined)) {
      this.checkoutForm.invoiceId().markAsTouched();
      this.invoiceInput()?.nativeElement.focus();
      return;
    }
    if (this.pending() === undefined && this.active()) return;
    this.saving.set(true);
    this.writeVersion++;
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
      this.operations.update((items) => [
        result.result,
        ...items.filter((item) => item.request.requestId !== request.requestId),
      ]);
      this.selected.set(request.requestId);
      this.checkoutForm().reset();
      this.paused.set(false);
      this.progress()?.nativeElement.focus();
    } finally {
      this.writeVersion++;
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
