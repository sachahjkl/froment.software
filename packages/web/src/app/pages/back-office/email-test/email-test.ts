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
import {
  FormField,
  disabled,
  form,
  maxLength,
  pattern,
  required,
  readonly as readOnly,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, EMPTY, exhaustMap, filter, timer } from 'rxjs';
import {
  EmailTestAddress,
  type EmailTestOperation,
  type EmailTestRequest,
} from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { ConnectionsApi } from '@backoffice/connections-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  selector: 'app-email-test',
  imports: [RouterLink, Button, Notice, FormField, DataTable, LocalizedDatePipe],
  templateUrl: './email-test.html',
  styleUrl: './email-test.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTest {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ConnectionsApi);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly addresses = EmailTestAddress;
  protected readonly saving = signal(false);
  protected readonly pending = signal<EmailTestRequest | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly credentialsPresent = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly paused = signal(false);
  protected readonly operations = signal<ReadonlyArray<EmailTestOperation>>([]);
  protected readonly selected = signal<string | undefined>(undefined);
  protected readonly current = computed(
    () =>
      this.operations().find((item) => item.request.requestId === this.selected()) ??
      this.operations()[0],
  );
  protected readonly active = computed(() =>
    this.operations().some((item) => ['queued', 'sending', 'retrying'].includes(item.status)),
  );
  protected readonly model = signal({
    subject: this.i18n.t('emailTest.defaultSubject'),
    body: this.i18n.t('emailTest.defaultBody'),
  });
  protected readonly messageForm = form(this.model, (path) => {
    disabled(path, () => this.saving());
    readOnly(path, () => this.pending() !== undefined);
    required(path.subject);
    pattern(path.subject, /\S/);
    pattern(path.subject, /^[^\r\n]*$/);
    maxLength(path.subject, 160);
    required(path.body);
    pattern(path.body, /\S/);
    maxLength(path.body, 20000);
  });
  protected readonly statusLabels = {
    queued: 'emailTest.queued',
    sending: 'emailTest.sending',
    retrying: 'emailTest.retrying',
    accepted: 'emailTest.accepted',
    delivered: 'emailTest.delivered',
    bounced: 'emailTest.bounced',
    complained: 'emailTest.complained',
    failed: 'emailTest.failed',
    blocked: 'emailTest.blocked',
  } satisfies Record<EmailTestOperation['status'], TranslationKey>;
  private readonly progress = viewChild('progress', { read: ElementRef<HTMLElement> });
  private readonly subjectInput = viewChild('subjectInput', { read: ElementRef<HTMLInputElement> });
  private readonly bodyInput = viewChild('bodyInput', { read: ElementRef<HTMLTextAreaElement> });

  constructor() {
    afterNextRender(() => {
      void this.loadConnections();
      timer(0, 3000)
        .pipe(
          filter(() => !this.paused() && !this.saving() && document.visibilityState === 'visible'),
          exhaustMap(() =>
            this.api.emailTests().pipe(
              catchError(() => {
                this.paused.set(true);
                this.loading.set(false);
                return EMPTY;
              }),
            ),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((operations) => {
          this.operations.set(operations);
          this.loading.set(false);
          const pending = this.pending();
          if (
            pending !== undefined &&
            operations.some((item) => item.request.requestId === pending.requestId)
          ) {
            this.pending.set(undefined);
            this.selected.set(pending.requestId);
            this.messageForm().reset();
            this.error.set(undefined);
          }
        });
    });
  }
  private async loadConnections(): Promise<void> {
    try {
      this.credentialsPresent.set(
        (await this.api.connections()).some(
          (connection) => connection.provider === 'resend' && connection.credentialsPresent,
        ),
      );
    } catch {
      this.error.set('connections.error');
    }
  }
  protected refresh(): void {
    this.paused.set(false);
    this.error.set(undefined);
    void this.loadConnections();
  }
  protected select(operation: EmailTestOperation): void {
    this.selected.set(operation.request.requestId);
    this.progress()?.nativeElement.focus();
  }
  protected invalid(field: 'subject' | 'body'): boolean {
    return this.messageForm[field]().invalid() && this.messageForm[field]().touched();
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.saving() &&
      (!this.messageForm().dirty() ||
        (await this.confirmation.request(this.i18n.t('emailTest.unsaved'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.messageForm().dirty() || this.saving()) event.preventDefault();
  }
  protected send(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.active() || !this.credentialsPresent() || this.loading()) return;
    if (this.messageForm().invalid()) {
      this.messageForm.subject().markAsTouched();
      this.messageForm.body().markAsTouched();
      (this.messageForm.subject().invalid()
        ? this.subjectInput()
        : this.bodyInput()
      )?.nativeElement.focus();
      return;
    }
    void submit(this.messageForm, async () => {
      this.saving.set(true);
      try {
        if (
          !(await this.confirmation.request(this.i18n.t('emailTest.confirm'), {
            acceptLabel: this.i18n.t('emailTest.send'),
          }))
        )
          return;
        this.error.set(undefined);
        const model = this.model();
        const request = this.pending() ?? { requestId: crypto.randomUUID(), ...model };
        this.pending.set(request);
        const outcome = await this.api.sendEmailTest(request);
        if (!outcome.success) {
          this.error.set(outcome.code);
          if (outcome.code !== 'emailTest.error') this.pending.set(undefined);
          return;
        }
        this.pending.set(undefined);
        this.operations.update((items) => [
          outcome.result,
          ...items.filter((item) => item.request.requestId !== request.requestId),
        ]);
        this.selected.set(request.requestId);
        this.messageForm().reset();
        this.paused.set(false);
        this.progress()?.nativeElement.focus();
      } finally {
        this.saving.set(false);
      }
    });
  }
}
