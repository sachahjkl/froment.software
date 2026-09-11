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
  validate,
} from '@angular/forms/signals';
import { CalendarDate, InvoiceRefundRequest } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { parseFixedDecimal } from '@backoffice/quote-input';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';
import { businessDate, businessToday } from '../billing/billing-state';

const emptyModel = () => ({ amount: '', refundedOn: '', reference: '' });

@Component({
  selector: 'app-refund-editor',
  imports: [Button, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './refund-editor.html',
  styleUrl: './refund-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, hasUnsavedChanges())',
  },
})
export class RefundEditor {
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
  protected readonly balance = computed(() => this.creditState()?.refundableCents ?? 0);
  protected readonly eligible = computed(() => this.balance() > 0);
  private readonly model = signal(emptyModel());
  private readonly baseline = JSON.stringify(this.model());
  protected readonly refundForm = form(this.model, (path) => {
    disabled(path, () => this.task.locked() || !this.eligible());
    required(path.amount);
    validate(path.amount, ({ value }) => {
      const amount = parseFixedDecimal(value(), 2);
      return amount === undefined || amount <= 0 || amount > this.balance()
        ? { kind: 'amount' }
        : undefined;
    });
    required(path.refundedOn);
    validate(path.refundedOn, ({ value }) => {
      const issuedAt = this.creditState()?.creditNote?.issuedAt;
      return !Schema.is(CalendarDate)(value()) ||
        value() > businessToday() ||
        (issuedAt !== undefined && value() < businessDate(issuedAt))
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
      this.refundForm()
        .errorSummary()
        .some((error) => error.kind === 'parse'),
  );
  private attempt: typeof InvoiceRefundRequest.Type | undefined;
  protected save(event: Event): void {
    event.preventDefault();
    if (this.task.locked() || !this.eligible()) return;
    void submit(this.refundForm, {
      action: async () => {
        const model = this.refundForm().value();
        const parsed = Schema.decodeUnknownOption(InvoiceRefundRequest)({
          amountCents: parseFixedDecimal(model.amount, 2),
          refundedOn: model.refundedOn,
          reference: model.reference.trim(),
          requestId: crypto.randomUUID(),
        });
        if (Option.isNone(parsed)) {
          this.task.error.set('invoice.credit_conflict');
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
      () => this.api.refund(invoice.id, request),
      'credit.confirmRefund',
    );
    if (result === 'resolved') this.attempt = undefined;
  }
  protected async reload(): Promise<void> {
    if (this.task.uncertain() || this.task.busy()) return;
    if (!(await this.task.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm'))))
      return;
    this.attempt = undefined;
    this.refundForm().reset(emptyModel());
    await this.task.load();
    this.credits.reload();
  }
  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.hasUnsavedChanges());
  }
}
