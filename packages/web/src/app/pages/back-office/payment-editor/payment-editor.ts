import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { CalendarDate, InvoicePaymentRequest } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { parseFixedDecimal } from '@backoffice/quote-input';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';
import { businessDate, businessToday, detailBalance } from '../billing/billing-state';

const emptyModel = () => ({ amount: '', paidOn: '', method: 'transfer', reference: '' });

@Component({
  selector: 'app-payment-editor',
  imports: [Can, Button, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './payment-editor.html',
  styleUrl: './payment-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, hasUnsavedChanges())',
  },
})
export class PaymentEditor {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  protected readonly balance = computed(() => {
    const invoice = this.task.invoice();
    return invoice ? detailBalance(invoice) : 0;
  });
  protected readonly eligible = computed(
    () =>
      this.task.invoice()?.status === 'issued' &&
      this.task.invoice()?.creditedCents === 0 &&
      this.balance() > 0,
  );
  private readonly model = signal(emptyModel());
  private readonly baseline = JSON.stringify(this.model());
  protected readonly paymentForm = form(this.model, (path) => {
    disabled(path, () => this.task.locked() || !this.eligible());
    required(path.amount);
    validate(path.amount, ({ value }) => {
      const amount = parseFixedDecimal(value(), 2);
      return amount === undefined || amount <= 0 || amount > this.balance()
        ? { kind: 'amount' }
        : undefined;
    });
    required(path.paidOn);
    validate(path.paidOn, ({ value }) => {
      const issuedAt = this.task.invoice()?.issuedAt;
      return !Schema.is(CalendarDate)(value()) ||
        value() > businessToday() ||
        (issuedAt != null && value() < businessDate(issuedAt))
        ? { kind: 'date' }
        : undefined;
    });
    required(path.reference);
    pattern(path.reference, /\S/);
    maxLength(path.reference, 160);
  });
  // Date-validity animations can mark unchanged values as dirty. Keep native parse errors protected.
  protected readonly hasUnsavedChanges = computed(
    () =>
      JSON.stringify(this.model()) !== this.baseline ||
      this.paymentForm()
        .errorSummary()
        .some((error) => error.kind === 'parse'),
  );
  private attempt: typeof InvoicePaymentRequest.Type | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.paymentForm, {
      action: async () => {
        const invoice = this.task.invoice();
        if (!invoice) return;
        const model = this.paymentForm().value();
        const parsed = Schema.decodeUnknownOption(InvoicePaymentRequest)({
          ...model,
          amountCents: parseFixedDecimal(model.amount, 2),
          reference: model.reference.trim(),
          expectedVersion: invoice.version,
          requestId: crypto.randomUUID(),
        });
        if (Option.isNone(parsed)) {
          this.task.error.set('invoice.payment_invalid');
          return;
        }
        this.attempt = parsed.value;
        await this.retry();
      },
      onInvalid: () => this.task.focusInvalid(),
    });
  }
  protected async retry(): Promise<void> {
    const invoice = this.task.invoice();
    const request = this.attempt;
    if (!invoice || !request) return;
    const result = await this.task.run(
      () => this.task.api.recordPayment(invoice.id, request),
      'payment.confirm',
      'record-payment',
    );
    if (result === 'resolved') this.attempt = undefined;
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.paymentForm().reset(emptyModel());
    await this.task.load();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.hasUnsavedChanges());
  }
}
import { Can } from '@backoffice/can';
