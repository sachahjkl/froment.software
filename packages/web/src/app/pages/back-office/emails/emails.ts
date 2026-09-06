import { Confirmation } from '@shared/confirmation/confirmation';
import { ActivatedRoute } from '@angular/router';
import { InvoiceReminder } from '@backoffice/invoice-reminder';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  disabled,
  email,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { EmailSubmission, Ulid, type IntegrationOperationValue } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

const blank = () => ({ recipient: '', reference: '', subject: '', body: '' });

@Component({
  imports: [Button, Notice, FormField, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-emails',
  styleUrl: './emails.scss',
  templateUrl: './emails.html',
})
export class Emails {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly reminder = inject(InvoiceReminder);
  protected readonly preparingReminder = signal(false);
  protected readonly reminderFailed = signal(false);
  protected readonly reminderPrepared = signal(false);
  private readonly model = signal(blank());
  protected readonly mode = signal<'simulation' | 'live' | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  protected readonly loadFailed = signal(false);
  protected readonly invalidRequest = signal(false);
  protected readonly completed = signal<'simulation' | 'live' | undefined>(undefined);
  protected readonly pending = signal<typeof EmailSubmission.Type | undefined>(undefined);
  protected readonly operations = signal<ReadonlyArray<IntegrationOperationValue>>([]);
  private readonly notice = viewChild('notice', { read: ElementRef<HTMLElement> });
  private readonly composer = viewChild('composer', { read: ElementRef<HTMLFormElement> });
  protected readonly messageForm = form(this.model, (path) => {
    disabled(path, () => this.saving() || this.preparingReminder() || this.pending() !== undefined);
    required(path.recipient);
    email(path.recipient);
    maxLength(path.recipient, 254);
    required(path.reference);
    pattern(path.reference, /\S/);
    maxLength(path.reference, 160);
    required(path.subject);
    pattern(path.subject, /\S/);
    maxLength(path.subject, 160);
    required(path.body);
    pattern(path.body, /\S/);
    maxLength(path.body, 20000);
  });
  constructor() {
    afterNextRender(() => {
      void this.load();
      void this.prepareReminder();
    });
  }
  private async prepareReminder(): Promise<void> {
    const value = this.route.snapshot.queryParamMap.get('invoice');
    if (value === null) return;
    const id = Schema.decodeUnknownOption(Ulid)(value);
    if (Option.isNone(id)) {
      this.reminderFailed.set(true);
      return;
    }
    this.preparingReminder.set(true);
    try {
      const draft = await this.reminder.prepare(id.value);
      if (draft === undefined) {
        this.reminderFailed.set(true);
        return;
      }
      this.model.set(draft);
      this.reminderPrepared.set(true);
    } catch {
      this.reminderFailed.set(true);
    } finally {
      this.preparingReminder.set(false);
    }
  }
  async load(): Promise<void> {
    if (this.saving()) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.mode.set(undefined);
    try {
      const [statuses, operations] = await Promise.all([this.api.status(), this.api.list('email')]);
      this.mode.set(statuses.find((provider) => provider.kind === 'email')?.mode);
      this.operations.set(operations);
      if (this.mode() === undefined) this.loadFailed.set(true);
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.saving() &&
      ((!this.messageForm().dirty() && !this.reminderPrepared() && this.pending() === undefined) ||
        (await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (
      this.messageForm().dirty() ||
      this.reminderPrepared() ||
      this.saving() ||
      this.pending() !== undefined
    )
      event.preventDefault();
  }
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.saving() ||
      this.preparingReminder() ||
      this.pending() !== undefined ||
      this.mode() === undefined
    )
      return;
    void submit(this.messageForm, async () => {
      const mode = this.mode();
      const request = Schema.decodeUnknownOption(EmailSubmission)({
        ...this.model(),
        kind: 'email',
        expectedMode: mode,
        requestId: crypto.randomUUID(),
      });
      if (Option.isNone(request)) {
        this.invalidRequest.set(true);
        return;
      }
      if (mode === 'live' && !(await this.confirmation.request(this.i18n.t('emails.confirmSend'))))
        return;
      this.pending.set(request.value);
      await this.send(request.value);
    });
  }
  protected async send(request: typeof EmailSubmission.Type): Promise<void> {
    if (this.saving() || request.expectedMode !== this.mode()) return;
    this.saving.set(true);
    this.failed.set(false);
    this.invalidRequest.set(false);
    this.completed.set(undefined);
    try {
      const outcome = await this.api.submit(request);
      if (!outcome.success) {
        this.failed.set(true);
        return;
      }
      this.operations.update((operations) =>
        [
          outcome.result,
          ...operations.filter((operation) => operation.id !== outcome.result.id),
        ].slice(0, 100),
      );
      if (this.pending()?.requestId === request.requestId) {
        this.pending.set(undefined);
        this.reminderPrepared.set(false);
        this.model.set(blank());
        this.messageForm().reset();
        this.composer()?.nativeElement.reset();
      }
      this.completed.set(outcome.result.receipt?.mode);
      this.notice()?.nativeElement.focus();
    } finally {
      this.saving.set(false);
    }
  }
  protected invalid(field: keyof ReturnType<typeof blank>): boolean {
    return this.messageForm[field]().invalid() && this.messageForm[field]().touched();
  }
}
