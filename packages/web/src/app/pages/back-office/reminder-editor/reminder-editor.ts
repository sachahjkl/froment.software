import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  PendingTasks,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReminderCreate, type InvoiceListValue } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { InvoicesApi } from '@backoffice/invoices-api';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { RemindersApi } from '@backoffice/reminders-api';
import {
  PendingProviderRequests,
  PendingReminder,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { formatMoney } from '@froment/l10n';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { ObjectPicker } from '@shared/object-picker/object-picker';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-reminder-editor',
  imports: [Button, FormField, LocalizedDatePipe, Notice, ObjectPicker, PageHeader, RouterLink],
  templateUrl: './reminder-editor.html',
  styleUrl: './reminder-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderEditor {
  protected readonly i18n = inject(I18nService);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly api = inject(RemindersApi);
  private readonly integrations = inject(IntegrationsApi);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly recovery = inject(PendingProviderRequests);
  private readonly pendingTasks = inject(PendingTasks);
  private store: PendingRequestStore<typeof PendingReminder.Type> | undefined;
  private readonly picker = viewChild(ObjectPicker);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly simulation = signal(false);
  protected readonly pending = signal<typeof PendingReminder.Type | undefined>(undefined);
  protected readonly model = signal({
    invoiceId: this.route.snapshot.queryParamMap.get('invoice') ?? '',
    date: '',
  });
  private readonly baseline = signal(JSON.stringify(this.model()));
  protected readonly scheduleForm = form(this.model, (path) => {
    required(path.invoiceId);
    required(path.date);
    disabled(
      path,
      () => this.busy() || this.confirming() || this.pending() !== undefined || this.completed(),
    );
  });
  // Native validity animations can mark unchanged values dirty. Keep incomplete native input guarded.
  protected readonly hasUnsavedChanges = computed(
    () =>
      JSON.stringify(this.model()) !== this.baseline() ||
      this.scheduleForm
        .date()
        .errors()
        .some((error) => error.kind === 'parse'),
  );
  protected readonly selected = computed(() =>
    this.invoices().find((invoice) => invoice.id === this.model().invoiceId),
  );
  protected readonly options = computed(() =>
    this.invoices().map((invoice) => ({
      id: invoice.id,
      label: `${invoice.invoiceNumber} — ${invoice.title}`,
      detail: `${invoice.clientDisplayName} · ${this.money(invoice.totalCents - invoice.recordedPaidCents)}`,
    })),
  );
  protected readonly timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  constructor() {
    afterNextRender(() => void this.pendingTasks.run(() => this.load()));
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  protected choose(id: string): void {
    if (this.busy() || this.confirming() || this.pending() || this.completed()) return;
    this.scheduleForm.invoiceId().value.set(id);
    this.scheduleForm.invoiceId().markAsDirty();
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.busy() &&
      !this.confirming() &&
      ((!this.hasUnsavedChanges() && !this.pending()) ||
        (await this.confirmation.request(this.i18n.t('emailsWorkspace.unsavedReminder'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.confirming() || this.pending() || this.hasUnsavedChanges())
      event.preventDefault();
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.error.set(undefined);
    try {
      this.store = await this.recovery.reminder();
      if (this.destroyRef.destroyed) return;
      const pending = this.store.read();
      this.pending.set(pending);
      if (pending) {
        const date = new Date(pending.request.sendAt);
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        this.model.set({ invoiceId: pending.request.invoiceId, date: localDate });
        this.baseline.set(JSON.stringify(this.model()));
      }
      const [invoices, providers] = await Promise.all([
        this.invoicesApi.list(),
        this.integrations.status(),
      ]);
      if (this.destroyRef.destroyed) return;
      this.invoices.set(
        invoices.filter(
          (invoice) =>
            invoice.status === 'issued' &&
            invoice.creditedCents === 0 &&
            invoice.totalCents > invoice.recordedPaidCents,
        ),
      );
      this.simulation.set(
        providers.find((provider) => provider.kind === 'email')?.mode === 'simulation',
      );
      if (pending) {
        const result = await this.api.list();
        if (this.destroyRef.destroyed) return;
        if (!result.success) {
          this.error.set(result.code);
          this.loadFailed.set(true);
          return;
        }
        const recorded = result.result.find((reminder) => reminder.id === pending.requestId);
        if (
          recorded &&
          recorded.invoiceId === pending.request.invoiceId &&
          recorded.expectedVersion === pending.request.expectedVersion &&
          recorded.sendAt === pending.request.sendAt &&
          recorded.language === pending.request.language &&
          recorded.expectedMode === pending.request.expectedMode
        ) {
          this.store.clear();
          this.pending.set(undefined);
          this.completed.set(true);
          this.scheduleForm().reset();
        }
      }
    } catch {
      if (!this.destroyRef.destroyed) {
        this.error.set('emailsWorkspace.recoveryError');
        this.loadFailed.set(true);
      }
    } finally {
      if (!this.destroyRef.destroyed) this.loading.set(false);
    }
  }
  protected async schedule(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.confirming() || this.completed() || this.loading() || this.loadFailed())
      return;
    if (this.pending()) {
      await this.retry();
      return;
    }
    this.scheduleForm().markAsTouched();
    if (!this.selected()) {
      this.error.set('emailsWorkspace.chooseInvoiceError');
      this.picker()?.focus();
      return;
    }
    const date = new Date(this.model().date);
    if (
      this.scheduleForm.date().invalid() ||
      !Number.isFinite(date.getTime()) ||
      date.getTime() <= Date.now() ||
      date.getTime() > Date.now() + 366 * 86400000 ||
      new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) !==
        this.model().date
    ) {
      this.error.set('emailsWorkspace.dateInvalid');
      this.scheduleForm.date().focusBoundControl();
      return;
    }
    if (!this.simulation()) {
      this.error.set('emailsWorkspace.simulationOnly');
      return;
    }
    const request = Schema.decodeUnknownOption(ReminderCreate)({
      invoiceId: this.model().invoiceId,
      sendAt: date.toISOString(),
      language: this.i18n.language(),
      expectedMode: 'simulation',
      expectedVersion: this.selected()?.version,
    });
    if (Option.isNone(request)) {
      this.error.set('reminder.conflict');
      return;
    }
    this.confirming.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('reminder.confirm')))) return;
    } finally {
      this.confirming.set(false);
    }
    if (this.destroyRef.destroyed || !this.store) return;
    const pending = { requestId: crypto.randomUUID(), request: request.value };
    try {
      this.store.write(pending);
    } catch {
      this.error.set('emailsWorkspace.recoveryError');
      return;
    }
    this.pending.set(pending);
    await this.retry();
  }
  protected async retry(): Promise<void> {
    const pending = this.pending();
    if (
      !pending ||
      !this.store ||
      this.busy() ||
      !this.simulation() ||
      pending.request.expectedMode !== 'simulation'
    )
      return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.create(pending.requestId, pending.request);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.store.clear();
      this.completed.set(true);
      this.pending.set(undefined);
      this.baseline.set(JSON.stringify(this.model()));
      this.scheduleForm().reset();
    } catch {
      this.error.set('reminder.error');
    } finally {
      this.busy.set(false);
    }
    if (this.completed()) await this.router.navigate(['/backoffice/courriels/reminders']);
  }
}
