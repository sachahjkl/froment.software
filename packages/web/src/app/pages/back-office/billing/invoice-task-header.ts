import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '@shared/page-header/page-header';
import { Badge } from '@shared/badge/badge';
import { Breadcrumbs, type BreadcrumbItem } from '@shared/breadcrumbs/breadcrumbs';
import { InvoiceTask } from './invoice-task';

@Component({
  imports: [PageHeader, RouterLink, Badge, Breadcrumbs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-invoice-task-header',
  styleUrl: './invoice-task-header.scss',
  template: `
    <app-page-header layout="stacked">
      <app-breadcrumbs
        pageBack
        [label]="task.i18n.t('backOfficeShell.breadcrumb')"
        [items]="breadcrumbs()"
        [current]="heading()"
      />
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
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      {
        label: this.task.i18n.t('backOffice.billing.title'),
        path: this.task.navigation.listLink(),
        queryParams: this.task.navigation.listQuery(),
      },
    ];
    const invoice = this.task.invoice();
    if (invoice)
      items.push({
        label: invoice.invoiceNumber ?? this.task.i18n.t('commercialHeader.draftInvoice'),
        path: ['/backoffice/invoices', invoice.id],
        queryParams: this.task.navigation.detailQuery(),
      });
    return items;
  });
}
