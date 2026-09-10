import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '@shared/page-header/page-header';
import { Badge } from '@shared/badge/badge';
import { InvoiceTask } from './invoice-task';

@Component({
  imports: [PageHeader, RouterLink, Badge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-invoice-task-header',
  styleUrl: './invoice-task-header.scss',
  template: `
    <app-page-header layout="stacked">
      <div pageBack>
        @if (task.invoice(); as invoice) {
          <a
            class="back-link"
            [routerLink]="['/backoffice/invoices', invoice.id]"
            [queryParams]="task.navigation.detailQuery()"
            >{{ task.i18n.t('billingWorkspace.backDetail') }}</a
          >
        } @else {
          <a
            class="back-link"
            [routerLink]="task.navigation.listLink()"
            [queryParams]="task.navigation.listQuery()"
            >{{ task.i18n.t('backOffice.backToBilling') }}</a
          >
        }
      </div>
      <h1 [id]="headingId()">{{ heading() }}</h1>
      @if (task.invoice(); as invoice) {
        <p>
          {{ task.i18n.t('backOffice.affair.invoice') }}
          {{ invoice.invoiceNumber ?? invoice.currentRevision.title }} ·
          <a [routerLink]="['/backoffice/clients', invoice.clientId, 'profile']">{{
            invoice.currentRevision.clientDisplayName
          }}</a>
        </p>
        <p>
          {{ task.i18n.t('commercial.order') }} {{ invoice.orderReference }} ·
          {{ task.i18n.t('backOffice.invoice.total') }}
          {{ task.money(invoice.currentRevision.totalCents) }}
        </p>
      }
      @if (task.invoice(); as invoice) {
        <span appBadge pageBadges>
          {{ task.i18n.tf('commercialHeader.savedVersion', { version: invoice.version }) }}
        </span>
      }
    </app-page-header>
  `,
})
export class InvoiceTaskHeader {
  readonly headingId = input.required<string>();
  readonly heading = input.required<string>();
  protected readonly task = inject(InvoiceTask);
}
