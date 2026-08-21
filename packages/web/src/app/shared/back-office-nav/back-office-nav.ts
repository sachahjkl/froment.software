import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { I18nService } from '@app/i18n.service';

@Component({
  selector: 'app-back-office-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav [attr.aria-label]="i18n.t('backOffice.navigation.label')">
      <a routerLink="/backoffice/dashboard" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.dashboard') }}
      </a>
      <a routerLink="/backoffice/clients" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.clients') }}
      </a>
      <a routerLink="/backoffice/affaires" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.affairs') }}
      </a>
      <a routerLink="/backoffice/facturation" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.billing') }}
      </a>
      <a routerLink="/backoffice/recherche" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.search') }}
      </a>
      <a routerLink="/backoffice/configuration" routerLinkActive="active">
        {{ i18n.t('backOffice.navigation.configuration') }}
      </a>
    </nav>
  `,
  styleUrl: './back-office-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeNav {
  protected readonly i18n = inject(I18nService);
}
