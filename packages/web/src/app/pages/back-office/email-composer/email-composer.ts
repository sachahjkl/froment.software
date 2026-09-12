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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  email,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EmailDraft,
  EmailDraftId,
  EmailDraftSave,
  EmailSubmission,
  EmailTemplate,
  Ulid,
  type IntegrationOperationValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { EmailDraftsApi } from '@backoffice/email-drafts-api';
import { EmailTemplatesApi } from '@backoffice/email-templates-api';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { InvoiceReminder } from '@backoffice/invoice-reminder';
import {
  PendingProviderRequests,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { ActionMenu } from '@shared/action-menu/action-menu';
import { FieldGroup } from '@shared/field-group/field-group';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { ObjectPicker } from '@shared/object-picker/object-picker';
import { PageHeader } from '@shared/page-header/page-header';
import { emailFilterQuery, emailQuery, emailView } from '../emails/email-workspace';

const blank = () => ({ recipient: '', reference: '', subject: '', body: '' });
type MessageField = keyof ReturnType<typeof blank>;

@Component({
  host: { class: 'page-container' },
  selector: 'app-email-composer',
  imports: [
    ActionMenu,
    Button,
    FieldGroup,
    FormField,
    Notice,
    ObjectPicker,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './email-composer.html',
  styleUrl: './email-composer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailComposer {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationsApi);
  private readonly draftsApi = inject(EmailDraftsApi);
  private readonly templatesApi = inject(EmailTemplatesApi);
  private readonly reminder = inject(InvoiceReminder);
  private readonly recovery = inject(PendingProviderRequests);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly templateError = signal<TranslationKey | undefined>(undefined);
  protected readonly mode = signal<'simulation' | 'live' | undefined>(undefined);
  protected readonly pending = signal<typeof EmailSubmission.Type | undefined>(undefined);
  protected readonly completed = signal(false);
  protected readonly archived = signal(false);
  protected readonly operation = signal<IntegrationOperationValue | undefined>(undefined);
  protected readonly draft = signal<typeof EmailDraft.Type | undefined>(undefined);
  protected readonly titleLabel = computed<TranslationKey>(() =>
    this.draft() ? 'emailsWorkspace.editDraft' : 'emailsWorkspace.newMessage',
  );
  protected readonly reminderPrepared = signal(false);
  protected readonly prepared = signal(false);
  protected readonly templates = signal<readonly (typeof EmailTemplate.Type)[]>([]);
  protected readonly draftActions = computed(() => [
    { id: 'archive', label: this.i18n.t('emailDraft.archive'), danger: true },
  ]);
  protected readonly templateOptions = computed(() =>
    this.templates().map((template) => ({ id: template.id, label: template.subject })),
  );
  protected readonly model = signal(blank());
  protected readonly messageForm = form(this.model, (path) => {
    disabled(
      path,
      () =>
        this.busy() || this.pending() !== undefined || this.completed() || this.state() !== 'ready',
    );
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
  private store: PendingRequestStore<typeof EmailSubmission.Type> | undefined;
  private draftId: string | undefined;
  private generation = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.pendingTasks.run(() => this.load())),
    );
  }
  protected backLink() {
    return ['/backoffice/emails', emailView(this.route.snapshot.queryParamMap.get('view'))];
  }
  protected backQuery() {
    return emailFilterQuery(emailQuery(this.route.snapshot.queryParamMap));
  }
  protected invalid(field: MessageField): boolean {
    return this.messageForm[field]().invalid() && this.messageForm[field]().touched();
  }
  private unsaved(): boolean {
    return (
      !this.completed() &&
      (this.messageForm().dirty() || this.prepared() || this.pending() !== undefined)
    );
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.busy() &&
      !this.confirming() &&
      (!this.unsaved() || (await this.confirmation.request(this.i18n.t('emailsWorkspace.unsaved'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.confirming() || this.unsaved()) event.preventDefault();
  }

  protected async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    this.error.set(undefined);
    this.templateError.set(undefined);
    this.completed.set(false);
    this.archived.set(false);
    this.operation.set(undefined);
    this.draft.set(undefined);
    this.draftId = undefined;
    this.prepared.set(false);
    this.reminderPrepared.set(false);
    this.pending.set(undefined);
    this.model.set(blank());
    this.messageForm().reset();
    try {
      const store = await this.recovery.businessEmail();
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.store = store;
      const pending = store.read();
      if (pending) {
        this.pending.set(pending);
        this.model.set(pending);
      }
      const [providers, templates] = await Promise.all([
        this.api.status(),
        this.templatesApi.list(),
      ]);
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      this.mode.set(providers.find((provider) => provider.kind === 'email')?.mode);
      if (templates.success) this.templates.set(templates.result);
      else this.templateError.set(templates.code);
      if (pending) {
        const operations = await this.api.list('email');
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        const operation = operations.find((item) => item.request.requestId === pending.requestId);
        if (
          operation?.request.kind === 'email' &&
          operation.receipt !== null &&
          operation.request.recipient === pending.recipient &&
          operation.request.reference === pending.reference &&
          operation.request.subject === pending.subject &&
          operation.request.body === pending.body &&
          operation.request.expectedMode === pending.expectedMode
        ) {
          store.clear();
          this.pending.set(undefined);
          this.completed.set(true);
          this.operation.set(operation);
          this.messageForm().reset();
        }
        this.state.set('ready');
        return;
      }
      const id = this.route.snapshot.paramMap.get('draftId');
      if (id !== null) {
        if (!Schema.is(EmailDraftId)(id)) {
          this.error.set('email_draft.not_found');
          this.state.set('error');
          return;
        }
        const outcome = await this.draftsApi.list();
        if (this.destroyRef.destroyed || generation !== this.generation) return;
        if (!outcome.success) {
          this.error.set(outcome.code);
          this.state.set('error');
          return;
        }
        const draft = outcome.result.find((item) => item.id === id);
        if (!draft) {
          this.error.set('email_draft.not_found');
          this.state.set('error');
          return;
        }
        this.draft.set(draft);
        this.draftId = draft.id;
        this.model.set(draft);
        this.reminderPrepared.set(draft.reminder);
      } else {
        const invoice = this.route.snapshot.queryParamMap.get('invoice');
        if (invoice !== null) {
          const decoded = Schema.decodeUnknownOption(Ulid)(invoice);
          const message = Option.isSome(decoded)
            ? await this.reminder.prepare(decoded.value)
            : undefined;
          if (this.destroyRef.destroyed || generation !== this.generation) return;
          if (!message) {
            this.error.set('emails.reminderFailed');
            this.state.set('error');
            return;
          }
          this.model.set(message);
          this.reminderPrepared.set(true);
          this.prepared.set(true);
        }
      }
      this.messageForm().reset();
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) {
        this.error.set('emailsWorkspace.recoveryError');
        this.state.set('error');
      }
    }
  }

  protected async applyTemplate(id: string): Promise<void> {
    const template = this.templates().find((item) => item.id === id);
    if (!template || this.busy() || this.confirming() || this.pending() || this.completed()) return;
    this.confirming.set(true);
    try {
      if (
        (this.model().subject || this.model().body) &&
        !(await this.confirmation.request(this.i18n.t('emailsWorkspace.replaceTemplate')))
      )
        return;
    } finally {
      this.confirming.set(false);
    }
    if (this.destroyRef.destroyed) return;
    this.model.update((value) => ({ ...value, subject: template.subject, body: template.body }));
    this.prepared.set(true);
  }

  private async persistDraft(): Promise<boolean> {
    const request = Schema.decodeUnknownOption(EmailDraftSave)({
      ...this.model(),
      reminder: this.reminderPrepared(),
      expectedVersion: this.draft()?.version ?? 0,
    });
    if (Option.isNone(request)) {
      this.error.set('emails.invalid');
      return false;
    }
    this.draftId ??= crypto.randomUUID();
    const outcome = await this.draftsApi.save(this.draftId, request.value);
    if (!outcome.success) {
      this.error.set(outcome.code);
      return false;
    }
    this.draft.set(outcome.result);
    this.prepared.set(false);
    this.messageForm().reset();
    return true;
  }
  protected async saveDraft(): Promise<void> {
    if (this.busy() || this.pending() || this.completed() || this.state() !== 'ready') return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      if (await this.persistDraft()) this.completed.set(true);
    } catch {
      this.error.set('emailDraft.error');
    } finally {
      this.busy.set(false);
    }
    if (this.completed())
      await this.router.navigate(['/backoffice/emails/drafts'], {
        queryParams: this.backQuery(),
      });
  }
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.busy() || this.pending() || this.completed() || this.state() !== 'ready') return;
    this.messageForm().markAsTouched();
    for (const field of ['recipient', 'reference', 'subject', 'body'] as const) {
      if (this.messageForm[field]().invalid()) {
        this.messageForm[field]().focusBoundControl();
        return;
      }
    }
    if (this.mode() !== 'simulation') {
      this.error.set('emailsWorkspace.simulationOnly');
      return;
    }
    void submit(this.messageForm, async () => {
      this.busy.set(true);
      this.error.set(undefined);
      try {
        if (!(await this.persistDraft())) return;
        const request = Schema.decodeUnknownOption(EmailSubmission)({
          ...this.model(),
          kind: 'email',
          requestId: this.draftId,
          expectedMode: 'simulation',
        });
        if (Option.isNone(request) || !this.store) {
          this.error.set('emails.invalid');
          return;
        }
        this.store.write(request.value);
        this.pending.set(request.value);
      } catch {
        this.error.set('emailsWorkspace.recoveryError');
      } finally {
        this.busy.set(false);
      }
      if (this.pending()) await this.retry();
    });
  }
  protected async retry(): Promise<void> {
    const request = this.pending();
    if (
      !request ||
      !this.store ||
      this.busy() ||
      request.expectedMode !== 'simulation' ||
      this.mode() !== 'simulation'
    )
      return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.submit(request);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.store.clear();
      this.operation.set(outcome.result);
      this.pending.set(undefined);
      this.prepared.set(false);
      this.completed.set(true);
      this.messageForm().reset();
    } catch {
      this.error.set('emails.error');
    } finally {
      this.busy.set(false);
    }
    const operation = this.operation();
    if (operation) await this.router.navigate(['/backoffice/emails/messages', operation.id]);
  }
  protected async archive(): Promise<void> {
    const draft = this.draft();
    if (!draft || this.busy() || this.confirming() || this.pending() || this.completed()) return;
    this.confirming.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('emailDraft.archiveConfirm')))) return;
    } finally {
      this.confirming.set(false);
    }
    if (this.destroyRef.destroyed) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.draftsApi.archive(draft);
      if (!outcome.success) this.error.set(outcome.code);
      else {
        this.archived.set(true);
        this.completed.set(true);
        this.prepared.set(false);
        this.messageForm().reset();
      }
    } catch {
      this.error.set('emailDraft.error');
    } finally {
      this.busy.set(false);
    }
    if (this.completed()) await this.router.navigate(['/backoffice/emails/drafts']);
  }
}
