import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, PageHeader, Button],
  host: { class: 'page-container' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-layout',
  styleUrl: './account-layout.scss',
  templateUrl: './account-layout.html',
})
export class AccountLayout {
  protected readonly i18n = inject(I18nService);
}
