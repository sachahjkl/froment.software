import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

@Component({
  imports: [RouterLink, RouterOutlet, PageHeader, Button, Tabs],
  host: { class: 'page-container' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-layout',
  styleUrl: './account-layout.scss',
  templateUrl: './account-layout.html',
})
export class AccountLayout {
  protected readonly i18n = inject(I18nService);
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['security', 'passkeys', 'sessions', 'preferences'] as const).map((page) => ({
      path: page,
      id: `account-${page}-tab`,
      label: this.i18n.t(`configurationWorkspace.${page}`),
    })),
  );
}
