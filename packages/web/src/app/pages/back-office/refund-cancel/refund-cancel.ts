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
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';

@Component({
  selector: 'app-refund-cancel',
  imports: [Button, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './refund-cancel.html',
  styleUrl: './refund-cancel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, cancelForm().dirty())',
  },
})
export class RefundCancel {
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
  protected readonly refund = computed(() =>
    this.creditState()?.refunds.find(
      (refund) => refund.id === this.task.route.snapshot.paramMap.get('refundId'),
    ),
  );
  protected readonly eligible = computed(() => this.refund()?.cancelledAt === null);
  protected readonly cancelForm = form(signal({ reason: '' }), (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 500);
    disabled(path, () => this.task.locked() || !this.eligible());
  });
  private attempt: string | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.cancelForm, {
      action: async () => {
        this.attempt = this.cancelForm().value().reason.trim();
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const invoice = this.task.invoice();
    const refund = this.refund();
    const reason = this.attempt;
    if (!invoice || !refund || reason === undefined) return;
    const result = await this.task.run(
      () => this.api.cancel(invoice.id, refund.id, reason),
      'credit.confirmCancel',
    );
    if (result === 'resolved') this.attempt = undefined;
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.cancelForm().reset({ reason: '' });
    await this.task.load();
    this.credits.reload();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.cancelForm().dirty());
  }
}
