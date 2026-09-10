import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from './invoice-task';

@Component({
  selector: 'app-invoice-task-feedback',
  imports: [Notice, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div data-task-feedback tabindex="-1">
    @if (task.busy()) {
      <p role="status">{{ task.i18n.t('billingWorkspace.pending') }}</p>
    }
    @if (task.completed()) {
      <p appNotice variant="success" role="status">
        {{ task.i18n.t('billingWorkspace.completed') }}
      </p>
    }
    @if (task.stale()) {
      <p appNotice variant="warning" role="alert">{{ task.i18n.t('billingWorkspace.stale') }}</p>
    }
    @if (task.uncertain()) {
      <p appNotice variant="warning" role="alert">
        {{ task.i18n.t('billingWorkspace.uncertain') }}
      </p>
    }
    @if (task.error(); as error) {
      <p appNotice variant="danger" role="alert">{{ task.i18n.t(error) }}</p>
    }
    @if (task.invoice(); as invoice) {
      <a [routerLink]="['/backoffice/invoices', invoice.id]">{{
        task.i18n.t('billingWorkspace.backDetail')
      }}</a>
    }
  </div>`,
})
export class TaskFeedback {
  protected readonly task = inject(InvoiceTask);
}
