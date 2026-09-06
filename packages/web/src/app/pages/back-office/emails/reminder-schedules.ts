import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { Reminder, ReminderSchedule } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { RemindersApi } from '@backoffice/reminders-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  imports: [FormField, Button, Notice, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-reminder-schedules',
  styleUrl: './reminder-schedules.scss',
  templateUrl: './reminder-schedules.html',
})
export class ReminderSchedules {
  readonly invoiceId = input<string>();
  readonly mode = input<'simulation' | 'live'>();
  readonly disabled = input(false);
  readonly busy = signal(false);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(RemindersApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly items = signal<ReadonlyArray<typeof Reminder.Type>>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  private readonly model = signal({ date: '' });
  private requestId: string | undefined;
  protected readonly scheduleForm = form(this.model, (path) => {
    required(path.date);
    disabled(path, () => this.busy() || this.disabled());
  });
  readonly hasChanges = computed(() => this.scheduleForm().dirty());
  protected readonly statusLabels = {
    scheduled: 'reminder.scheduled',
    cancelled: 'reminder.cancelled',
    skipped: 'reminder.skipped',
    queued: 'reminder.queued',
  } satisfies Record<(typeof Reminder.Type)['status'], TranslationKey>;
  protected readonly reasonLabels = {
    'invoice-ineligible': 'reminder.invoice-ineligible',
    'recipient-invalid': 'reminder.recipient-invalid',
    'permission-revoked': 'reminder.permission-revoked',
    'mode-changed': 'reminder.mode-changed',
  } satisfies Record<NonNullable<(typeof Reminder.Type)['reason']>, TranslationKey>;
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    const outcome = await this.api.list();
    if (outcome.success) {
      this.items.set(outcome.result);
      this.error.set(undefined);
    } else this.error.set(outcome.code);
    this.loading.set(false);
  }
  protected async schedule(event: Event): Promise<void> {
    event.preventDefault();
    const invoiceId = this.invoiceId();
    const expectedMode = this.mode();
    if (this.busy() || this.disabled() || invoiceId === undefined || expectedMode === undefined)
      return;
    const date = new Date(this.model().date);
    if (!Number.isFinite(date.getTime())) {
      this.error.set('reminder.conflict');
      return;
    }
    const request = Schema.decodeUnknownOption(ReminderSchedule)({
      invoiceId,
      expectedMode,
      language: this.i18n.language(),
      sendAt: date.toISOString(),
    });
    if (Option.isNone(request)) {
      this.error.set('reminder.conflict');
      return;
    }
    if (!(await this.confirmation.request(this.i18n.t('reminder.confirm')))) return;
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(undefined);
    this.requestId ??= crypto.randomUUID();
    try {
      const outcome = await this.api.create(this.requestId, request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.items.update((items) => [
        outcome.result,
        ...items.filter((item) => item.id !== outcome.result.id),
      ]);
      this.saved.set(true);
      this.scheduleForm().reset(this.model());
      this.requestId = undefined;
    } finally {
      this.busy.set(false);
    }
  }
  protected async cancel(item: typeof Reminder.Type): Promise<void> {
    if (this.busy() || this.disabled()) return;
    if (!(await this.confirmation.request(this.i18n.t('reminder.cancelConfirm')))) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.cancel(item.id);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.items.update((items) =>
        items.map((current) => (current.id === item.id ? outcome.result : current)),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
