import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { Authentication } from '@backoffice/authentication';

@Component({
  selector: 'app-billing-nav',
  host: { style: 'display: block; min-inline-size: 0' },
  imports: [Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-tabs [label]="i18n.t('backOffice.billing.title')" [tabs]="items()" />`,
})
export class BillingNav {
  private readonly authentication = inject(Authentication);
  protected readonly i18n = inject(I18nService);
  protected readonly items = computed<readonly TabItem[]>(() =>
    (
      [
        {
          path: '/backoffice/billing',
          id: 'billing-invoices-tab',
          permissions: ['invoice.read'],
          label: this.i18n.t('billingWorkspace.invoices'),
        },
        {
          path: '/backoffice/billing/receipts',
          id: 'billing-receipts-tab',
          permissions: ['invoice.read', 'payment.read'],
          label: this.i18n.t('billingWorkspace.receipts'),
        },
        {
          path: '/backoffice/billing/credit-notes',
          id: 'billing-credits-tab',
          permissions: ['invoice.read'],
          label: this.i18n.t('billingWorkspace.credits'),
        },
        {
          path: '/backoffice/billing/refunds',
          id: 'billing-refunds-tab',
          permissions: ['invoice.read', 'payment.read'],
          label: this.i18n.t('billingWorkspace.refunds'),
        },
      ] as const
    ).filter((item) => item.permissions.every((permission) => this.authentication.can(permission))),
  );
}
