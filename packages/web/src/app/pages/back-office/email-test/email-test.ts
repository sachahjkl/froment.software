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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  EmailTestAddress,
  type EmailTestOperation,
  type EmailTestRequest,
} from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { ConnectionsApi } from '@backoffice/connections-api';
import {
  PendingProviderRequests,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { providerTabs, providerTestParams } from '../connections/provider-navigation';
import { EmailTestHistory } from './email-test-history';
import { emailTestStatusLabel } from './email-test-view';

@Component({
  host: { class: 'page-container' },
  selector: 'app-email-test',
  imports: [RouterLink, Button, Notice, FormField, PageHeader, Tabs],
  providers: [EmailTestHistory],
  templateUrl: './email-test.html',
  styleUrl: './email-test.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTest {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ConnectionsApi);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requests = inject(PendingProviderRequests);
  private readonly route = inject(ActivatedRoute);
  protected readonly history = inject(EmailTestHistory);
  protected readonly completed = signal(false);
  private requestStore: PendingRequestStore<EmailTestRequest> | undefined;
  protected readonly recoveryReady = signal(false);
  protected readonly addresses = EmailTestAddress;
  protected readonly saving = signal(false);
  protected readonly pending = signal<EmailTestRequest | undefined>(undefined);
  protected readonly credentialsPresent = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly testParams = computed(() => providerTestParams('resend', this.queryParams()));
  protected readonly tabs = computed(() => providerTabs('resend', this.i18n, this.selected()));
  protected readonly selected = signal<string | undefined>(undefined);
  protected readonly current = computed(() =>
    this.history.operations().find((item) => item.request.requestId === this.selected()),
  );
  protected readonly active = computed(() =>
    this.history
      .operations()
      .some((item) => ['queued', 'sending', 'retrying'].includes(item.status)),
  );
  protected readonly model = signal({
    subject: this.i18n.t('emailTest.defaultSubject'),
    body: this.i18n.t('emailTest.defaultBody'),
  });
  protected readonly messageForm = form(this.model, (path) => {
    disabled(path, () => this.saving() || !this.recoveryReady() || this.completed());
    readOnly(path, () => this.pending() !== undefined);
    required(path.subject);
    pattern(path.subject, /\S/);
    pattern(path.subject, /^[^\r\n]*$/);
    maxLength(path.subject, 160);
    required(path.body);
    pattern(path.body, /\S/);
    maxLength(path.body, 20000);
  });
  protected readonly statusLabel = emailTestStatusLabel;
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.saving()) return 'emailTest.saving';
    if (this.pending()) return 'emailTest.resume';
    return 'emailTest.send';
  });
  private readonly progress = viewChild('progress', { read: ElementRef<HTMLElement> });
  private readonly subjectInput = viewChild('subjectInput', { read: ElementRef<HTMLInputElement> });
  private readonly bodyInput = viewChild('bodyInput', { read: ElementRef<HTMLTextAreaElement> });

  constructor() {
    afterRenderEffect(() => {
      if (this.completed()) this.progress()?.nativeElement.focus();
    });
    afterNextRender(() => {
      void this.loadConnections();
      void this.restoreRequest();
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
      this.requestStore = await this.requests.email();
      const request = this.requestStore.read();
      if (request !== undefined) {
        this.pending.set(request);
        this.model.set({ subject: request.subject, body: request.body });
        this.selected.set(request.requestId);
      }
      this.recoveryReady.set(true);
      this.reconcileRequest(this.history.operations());
    } catch {
      this.error.set('emailTest.recoveryUnavailable');
    }
  }
  private reconcileRequest(operations: readonly EmailTestOperation[]): void {
    const pending = this.pending();
    if (
      pending === undefined ||
      !operations.some((item) => item.request.requestId === pending.requestId) ||
      !this.clearPending()
    )
      return;
    this.selected.set(pending.requestId);
    this.completed.set(true);
    this.messageForm().reset();
    this.error.set(undefined);
  }
  private clearPending(): boolean {
    try {
      if (this.requestStore === undefined) throw new Error('pending_request.storage_unavailable');
      this.requestStore.clear();
      this.pending.set(undefined);
      return true;
    } catch {
      this.error.set('emailTest.recoveryUnavailable');
      return false;
    }
  }
  private async loadConnections(): Promise<void> {
    this.credentialsPresent.set(false);
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
    this.history.refresh();
    this.error.set(undefined);
    void this.loadConnections();
    if (!this.recoveryReady()) void this.restoreRequest();
  }
  protected invalid(field: 'subject' | 'body'): boolean {
    return this.messageForm[field]().invalid() && this.messageForm[field]().touched();
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.saving() &&
      ((!this.messageForm().dirty() && this.pending() === undefined) ||
        (await this.confirmation.request(this.i18n.t('emailTest.unsaved'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.messageForm().dirty() || this.saving() || this.pending() !== undefined)
      event.preventDefault();
  }
  protected send(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.saving() ||
      this.completed() ||
      this.active() ||
      !this.credentialsPresent() ||
      this.history.loading() ||
      !this.recoveryReady()
    )
      return;
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
      this.history.invalidate();
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
        try {
          if (this.requestStore === undefined)
            throw new Error('pending_request.storage_unavailable');
          this.requestStore.write(request);
        } catch {
          this.error.set('emailTest.recoveryUnavailable');
          return;
        }
        this.pending.set(request);
        const outcome = await this.api.sendEmailTest(request);
        if (!outcome.success) {
          this.error.set(outcome.code);
          if (outcome.code !== 'emailTest.error') this.clearPending();
          return;
        }
        this.clearPending();
        this.history.record(outcome.result);
        this.selected.set(request.requestId);
        this.completed.set(true);
        this.messageForm().reset();
        this.history.refresh();
        this.progress()?.nativeElement.focus();
      } finally {
        this.history.invalidate();
        this.saving.set(false);
      }
    });
  }
}
