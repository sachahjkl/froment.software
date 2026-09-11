import { Can } from '@backoffice/can';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { disabled, form, FormField, submit, validate } from '@angular/forms/signals';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';

@Component({
  selector: 'app-invoice-void',
  imports: [Can, Button, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './invoice-void.html',
  styleUrl: './invoice-void.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, voidForm().dirty())',
  },
})
export class InvoiceVoid {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  protected readonly eligible = computed(() => {
    const invoice = this.task.invoice();
    return (
      invoice?.status === 'issued' && invoice.creditedCents === 0 && invoice.payments.length === 0
    );
  });
  protected readonly voidForm = form(signal({ confirmed: false }), (path) => {
    disabled(path, () => this.task.locked() || !this.eligible());
    validate(path.confirmed, ({ value }) => (value() ? undefined : { kind: 'required' }));
  });
  private attempt: { id: string; version: number } | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.voidForm, {
      action: async () => {
        const invoice = this.task.invoice();
        if (!invoice) return;
        this.attempt = { id: invoice.id, version: invoice.version };
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const attempt = this.attempt;
    if (!attempt) return;
    await this.task.run(
      () => this.task.api.void(attempt.id, { expectedVersion: attempt.version }),
      'backOffice.invoice.voidConfirm',
      'void',
    );
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.voidForm().reset({ confirmed: false });
    await this.task.load();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.voidForm().dirty());
  }
}
