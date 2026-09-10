import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

@Component({
  selector: 'app-billing-nav',
  host: { style: 'display: block; min-inline-size: 0' },
  imports: [Tabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-tabs [label]="i18n.t('backOffice.billing.title')" [tabs]="items()" />`,
})
export class BillingNav {
  protected readonly i18n = inject(I18nService);
  protected readonly items = computed<readonly TabItem[]>(() => [
    {
      path: '/backoffice/facturation',
      id: 'billing-invoices-tab',
      label: this.i18n.t('billingWorkspace.invoices'),
    },
    {
      path: '/backoffice/facturation/encaissements',
      id: 'billing-receipts-tab',
      label: this.i18n.t('billingWorkspace.receipts'),
    },
    {
      path: '/backoffice/facturation/avoirs',
      id: 'billing-credits-tab',
      label: this.i18n.t('billingWorkspace.credits'),
    },
    {
      path: '/backoffice/facturation/remboursements',
      id: 'billing-refunds-tab',
      label: this.i18n.t('billingWorkspace.refunds'),
    },
  ]);
}
