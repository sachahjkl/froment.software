import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { disabled, form, FormField, submit, validate } from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';

@Component({
  selector: 'app-invoice-issue',
  imports: [Can, Button, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './invoice-issue.html',
  styleUrl: './invoice-issue.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, issueForm().dirty())',
  },
})
export class InvoiceIssue {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly eligible = computed(() => this.task.invoice()?.status === 'draft');
  protected readonly issueForm = form(signal({ confirmed: false }), (path) => {
    disabled(path, () => this.task.locked() || !this.eligible());
    validate(path.confirmed, ({ value }) => (value() ? undefined : { kind: 'required' }));
  });
  protected readonly preview = computed(() => {
    const invoice = this.task.invoice();
    return invoice === undefined
      ? undefined
      : this.sanitizer.bypassSecurityTrustResourceUrl(
          `/api/invoices/${invoice.id}/revisions/${invoice.version}/preview`,
        );
  });
  private attempt: { id: string; version: number } | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked()) return;
    void submit(this.issueForm, {
      action: async () => {
        const invoice = this.task.invoice();
        if (invoice?.status !== 'draft') return;
        this.attempt = { id: invoice.id, version: invoice.version };
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const attempt = this.attempt;
    if (attempt === undefined) return;
    await this.task.run(
      () => this.task.api.issue(attempt.id, attempt.version),
      'backOffice.invoice.issueConfirm',
      'issue',
    );
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.issueForm().reset({ confirmed: false });
    await this.task.load();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.issueForm().dirty());
  }
}
import { Can } from '@backoffice/can';
