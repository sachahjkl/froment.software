import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { InvoiceTask } from './invoice-task';
@Component({
  selector: 'app-invoice-task-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (task.loading()) {
      <p role="status">{{ task.i18n.t('backOffice.invoices.loading') }}</p>
    }
    @if (task.invoice(); as invoice) {
      <div class="ds-panel">
        <strong>{{ invoice.invoiceNumber ?? invoice.currentRevision.title }}</strong>
        <p>{{ invoice.currentRevision.clientDisplayName }} · {{ invoice.orderReference }}</p>
        <p>
          {{ task.money(invoice.currentRevision.totalCents) }} ·
          {{ task.i18n.tf('billingWorkspace.version', { version: invoice.version }) }}
        </p>
      </div>
    }`,
  styles: `
    .ds-panel {
      padding: var(--space-4);
      max-inline-size: 52rem;
    }
    p {
      margin-block-start: var(--space-2);
    }
  `,
})
export class TaskSummary {
  protected readonly task = inject(InvoiceTask);
}
