import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Notice } from '@shared/notice/notice';
import { DocumentIssues } from '@shared/document-issues/document-issues';
import { InvoiceTask } from './invoice-task';

@Component({
  selector: 'app-invoice-task-feedback',
  imports: [Notice, RouterLink, DocumentIssues],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="feedback" data-task-feedback tabindex="-1">
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
    } @else if (task.uncertain()) {
      <p appNotice variant="warning" role="alert">
        {{ task.i18n.t('billingWorkspace.uncertain') }}
      </p>
    } @else if (!task.issues().length && task.error(); as error) {
      <p appNotice variant="danger" role="alert">{{ task.i18n.t(error) }}</p>
    }
    @if (task.issues().length && task.invoice(); as invoice) {
      <app-document-issues [issues]="task.issues()" [clientId]="invoice.clientId" kind="invoice" />
    }
    @if (task.invoice(); as invoice) {
      <a
        [routerLink]="['/backoffice/invoices', invoice.id]"
        [queryParams]="task.navigation.detailQuery()"
        >{{ task.i18n.t('billingWorkspace.backDetail') }}</a
      >
    } @else {
      <a [routerLink]="task.navigation.listLink()" [queryParams]="task.navigation.listQuery()">{{
        task.i18n.t('backOffice.backToBilling')
      }}</a>
    }
  </div>`,
  styles: `
    .feedback {
      display: grid;
      justify-items: start;
      gap: var(--space-3);
    }
    p {
      margin: 0;
    }
    app-document-issues {
      margin: 0;
    }
  `,
})
export class TaskFeedback {
  protected readonly task = inject(InvoiceTask);
}
