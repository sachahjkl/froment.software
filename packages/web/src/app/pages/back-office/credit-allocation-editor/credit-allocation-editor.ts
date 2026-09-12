import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { InvoiceCreditAllocationRequest } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { parseFixedDecimal } from '@backoffice/quote-input';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';
import { businessToday } from '../billing/billing-state';

@Component({
  selector: 'app-credit-allocation-editor',
  imports: [Button, FormsModule, InvoiceTaskHeader, Notice],
  providers: [InvoiceTask],
  templateUrl: './credit-allocation-editor.html',
  styleUrl: './credit-allocation-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container' },
})
export class CreditAllocationEditor {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly creditsApi = inject(InvoiceCreditsApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly router = inject(Router);
  protected readonly credits = resource({
    params: () => this.task.invoice()?.id,
    loader: ({ params }) => this.creditsApi.get(params),
  });
  protected readonly invoices = resource({ loader: () => this.invoicesApi.list() });
  protected readonly balance = computed(() => {
    const value = this.credits.hasValue() ? this.credits.value() : undefined;
    return value?.success ? value.result.refundableCents : 0;
  });
  protected readonly targets = computed(() => {
    const source = this.task.invoice();
    if (source === undefined || !this.invoices.hasValue()) return [];
    return this.invoices
      .value()
      .filter(
        (invoice) =>
          invoice.id !== source.id &&
          invoice.clientId === source.clientId &&
          invoice.currency === source.currentRevision.currency &&
          invoice.status === 'issued' &&
          invoice.totalCents - invoice.recordedPaidCents - invoice.creditedCents > 0,
      );
  });
  protected readonly targetInvoiceId = signal('');
  protected readonly amount = signal('');
  protected readonly allocatedOn = signal(businessToday());
  protected readonly reference = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal(false);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    const source = this.task.invoice();
    if (source === undefined || this.busy()) return;
    const request = Schema.decodeUnknownOption(InvoiceCreditAllocationRequest)({
      requestId: crypto.randomUUID(),
      targetInvoiceId: this.targetInvoiceId(),
      amountCents: parseFixedDecimal(this.amount(), 2),
      allocatedOn: this.allocatedOn(),
      reference: this.reference().trim(),
    });
    if (Option.isNone(request) || request.value.amountCents > this.balance()) {
      this.error.set(true);
      return;
    }
    this.busy.set(true);
    const outcome = await this.creditsApi.allocate(source.id, request.value);
    this.busy.set(false);
    if (!outcome.success) {
      this.error.set(true);
      return;
    }
    await this.router.navigate(['/backoffice/invoices', source.id], {
      queryParams: this.task.navigation.detailQuery(),
    });
  }

  canDeactivate(): boolean {
    return !this.busy();
  }
}
