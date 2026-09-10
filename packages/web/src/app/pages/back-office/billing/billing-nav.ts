import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '@app/i18n.service';

@Component({
  selector: 'app-billing-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<nav [attr.aria-label]="i18n.t('backOffice.billing.title')">
    @for (item of items; track item.path) {
      <a
        [routerLink]="item.path"
        routerLinkActive="active"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{
          paths: 'exact',
          queryParams: 'ignored',
          fragment: 'ignored',
          matrixParams: 'ignored',
        }"
        >{{ i18n.t(item.label) }}</a
      >
    }
  </nav>`,
  styles: `
    nav {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      border-bottom: 1px solid var(--color-line);
      padding-block-end: var(--space-3);
    }
    a {
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--color-muted);
    }
    a.active {
      background: var(--color-panel);
      color: var(--color-ink);
      box-shadow: var(--shadow-panel);
      font-weight: 700;
    }
  `,
})
export class BillingNav {
  protected readonly i18n = inject(I18nService);
  protected readonly items = [
    { path: '/backoffice/facturation', label: 'billingWorkspace.invoices' },
    { path: '/backoffice/facturation/encaissements', label: 'billingWorkspace.receipts' },
    { path: '/backoffice/facturation/avoirs', label: 'billingWorkspace.credits' },
    { path: '/backoffice/facturation/remboursements', label: 'billingWorkspace.refunds' },
  ] as const;
}
