import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { CreditNoteRequest } from '@froment/contracts';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { TaskSummary } from '../billing/task-summary';

@Component({
  selector: 'app-credit-editor',
  imports: [Button, Notice, FormField, TaskFeedback, TaskSummary],
  providers: [InvoiceTask],
  templateUrl: './credit-editor.html',
  styleUrl: './credit-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, creditForm().dirty())',
  },
})
export class CreditEditor {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly api = inject(InvoiceCreditsApi);
  protected readonly credits = resource({
    params: () => this.task.invoice()?.id,
    loader: ({ params }) => this.api.get(params),
  });
  protected readonly creditState = computed(() => {
    const value = this.credits.hasValue() ? this.credits.value() : undefined;
    return value?.success ? value.result : undefined;
  });
  protected readonly eligible = computed(() => {
    const invoice = this.task.invoice();
    return (
      invoice !== undefined &&
      (invoice.status === 'issued' || invoice.status === 'paid') &&
      invoice.currentRevision.totalCents > 0 &&
      this.creditState()?.creditNote === null
    );
  });
  protected readonly creditForm = form(signal({ reason: '' }), (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 1000);
    disabled(path, () => this.task.locked() || !this.eligible());
  });
  private attempt: typeof CreditNoteRequest.Type | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.creditForm, {
      action: async () => {
        const invoice = this.task.invoice();
        if (!invoice) return;
        this.attempt = {
          requestId: crypto.randomUUID(),
          expectedVersion: invoice.version,
          reason: this.creditForm().value().reason.trim(),
        };
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const invoice = this.task.invoice();
    const request = this.attempt;
    if (!invoice || !request) return;
    await this.task.run(() => this.api.issue(invoice.id, request), 'credit.confirmIssue');
    if (!this.task.uncertain()) this.attempt = undefined;
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.creditForm().reset({ reason: '' });
    await this.task.load();
    this.credits.reload();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.creditForm().dirty());
  }
}
