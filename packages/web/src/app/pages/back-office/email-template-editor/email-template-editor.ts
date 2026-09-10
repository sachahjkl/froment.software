import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EmailTemplate, EmailTemplateId, EmailTemplateSave } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { EmailTemplatesApi } from '@backoffice/email-templates-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { emailQuery } from '../emails/email-workspace';

@Component({
  host: { class: 'page-container' },
  selector: 'app-email-template-editor',
  imports: [Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './email-template-editor.html',
  styleUrl: './email-template-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplateEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(EmailTemplatesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(Confirmation);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly completed = signal(false);
  protected readonly archived = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly template = signal<typeof EmailTemplate.Type | undefined>(undefined);
  protected readonly model = signal({ subject: '', body: '' });
  protected readonly templateForm = form(this.model, (path) => {
    disabled(path, () => this.busy() || this.completed() || this.state() !== 'ready');
    required(path.subject);
    pattern(path.subject, /\S/);
    maxLength(path.subject, 160);
    required(path.body);
    pattern(path.body, /\S/);
    maxLength(path.body, 20000);
  });
  private requestId: string | undefined;
  private generation = 0;
  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }
  protected backQuery() {
    return emailQuery(this.route.snapshot.queryParamMap);
  }
  protected invalid(field: 'subject' | 'body'): boolean {
    return this.templateForm[field]().touched() && this.templateForm[field]().invalid();
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.busy() &&
      !this.confirming() &&
      (!this.templateForm().dirty() ||
        (await this.confirmation.request(this.i18n.t('emailsWorkspace.unsavedTemplate'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.confirming() || this.templateForm().dirty()) event.preventDefault();
  }
  protected async load(): Promise<void> {
    const generation = ++this.generation;
    this.state.set('loading');
    this.error.set(undefined);
    this.template.set(undefined);
    this.completed.set(false);
    this.archived.set(false);
    this.model.set({ subject: '', body: '' });
    this.templateForm().reset();
    this.requestId = undefined;
    const id = this.route.snapshot.paramMap.get('templateId');
    if (id === null) {
      this.state.set('ready');
      return;
    }
    if (!Schema.is(EmailTemplateId)(id)) {
      this.error.set('email_template.not_found');
      this.state.set('error');
      return;
    }
    try {
      const outcome = await this.api.list();
      if (this.destroyRef.destroyed || generation !== this.generation) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      const template = outcome.result.find((item) => item.id === id);
      if (!template) {
        this.error.set('email_template.not_found');
        this.state.set('error');
        return;
      }
      this.template.set(template);
      this.model.set({ subject: template.subject, body: template.body });
      this.templateForm().reset();
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generation) {
        this.error.set('emailTemplate.error');
        this.state.set('error');
      }
    }
  }
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.busy() || this.completed() || this.state() !== 'ready') return;
    this.templateForm().markAsTouched();
    for (const field of ['subject', 'body'] as const) {
      if (this.templateForm[field]().invalid()) {
        this.templateForm[field]().focusBoundControl();
        return;
      }
    }
    void submit(this.templateForm, async () => {
      const request = Schema.decodeUnknownOption(EmailTemplateSave)({
        ...this.model(),
        expectedVersion: this.template()?.version ?? 0,
      });
      if (Option.isNone(request)) {
        this.error.set('emails.invalid');
        return;
      }
      this.requestId ??= this.template()?.id ?? crypto.randomUUID();
      this.busy.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.save(this.requestId, request.value);
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.template.set(outcome.result);
        this.templateForm().reset();
        this.completed.set(true);
      } catch {
        this.error.set('emailTemplate.error');
      } finally {
        this.busy.set(false);
      }
      if (this.completed())
        await this.router.navigate(['/backoffice/courriels/templates'], {
          queryParams: this.backQuery(),
        });
    });
  }
  protected async archive(): Promise<void> {
    const template = this.template();
    if (!template || this.busy() || this.confirming() || this.completed()) return;
    this.confirming.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('emailTemplate.archiveConfirm')))) return;
    } finally {
      this.confirming.set(false);
    }
    if (this.destroyRef.destroyed) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.api.archive(template);
      if (!outcome.success) this.error.set(outcome.code);
      else {
        this.archived.set(true);
        this.templateForm().reset();
        this.completed.set(true);
      }
    } catch {
      this.error.set('emailTemplate.error');
    } finally {
      this.busy.set(false);
    }
    if (this.completed())
      await this.router.navigate(['/backoffice/courriels/templates'], {
        queryParams: this.backQuery(),
      });
  }
}
