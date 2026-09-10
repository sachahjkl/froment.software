import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';
import { Button } from '@shared/button/button';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggle, Button],
  host: { class: 'page-container' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-layout',
  styleUrl: './account-layout.scss',
  templateUrl: './account-layout.html',
})
export class AccountLayout {
  protected readonly i18n = inject(I18nService);
}
