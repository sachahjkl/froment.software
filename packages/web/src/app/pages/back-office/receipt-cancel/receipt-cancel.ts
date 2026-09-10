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
import { type InvoicePaymentCancelRequestValue } from '@froment/contracts';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { TaskSummary } from '../billing/task-summary';
import { canCancelPayment } from '../billing/receipt-cancellation';

@Component({
  selector: 'app-receipt-cancel',
  imports: [Button, Notice, FormField, TaskFeedback, TaskSummary],
  providers: [InvoiceTask],
  templateUrl: './receipt-cancel.html',
  styleUrl: './receipt-cancel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, cancelForm().dirty())',
  },
})
export class ReceiptCancel {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly creditsApi = inject(InvoiceCreditsApi);
  protected readonly credits = resource({
    params: () => {
      const invoice = this.task.invoice();
      if (!invoice) return undefined;
      return { invoiceId: invoice.id, version: invoice.version };
    },
    loader: ({ params }) => this.creditsApi.get(params.invoiceId),
  });
  protected readonly creditState = computed(() => {
    if (this.credits.isLoading()) return undefined;
    const value = this.credits.hasValue() ? this.credits.value() : undefined;
    return value?.success ? value.result : undefined;
  });
  protected readonly payment = computed(() =>
    this.task
      .invoice()
      ?.payments.find(
        (payment) => payment.id === this.task.route.snapshot.paramMap.get('paymentId'),
      ),
  );
  protected readonly eligible = computed(() =>
    canCancelPayment(this.task.invoice(), this.payment(), this.creditState()),
  );
  protected readonly cancelForm = form(signal({ reason: '' }), (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 500);
    disabled(path, () => this.task.locked() || !this.eligible());
  });
  private attempt: InvoicePaymentCancelRequestValue | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.cancelForm, {
      action: async () => {
        const invoice = this.task.invoice();
        if (!invoice) return;
        this.attempt = {
          expectedVersion: invoice.version,
          reason: this.cancelForm().value().reason.trim(),
        };
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const invoice = this.task.invoice();
    const payment = this.payment();
    const request = this.attempt;
    if (!invoice || !payment || !request) return;
    await this.task.run(
      () => this.task.api.cancelPayment(invoice.id, payment.id, request),
      'payment.cancel_confirm',
    );
    if (!this.task.uncertain()) this.attempt = undefined;
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
