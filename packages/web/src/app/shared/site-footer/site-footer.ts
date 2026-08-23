import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { LanguageSelector } from '@shared/language-selector/language-selector';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';

@Component({
  selector: 'app-site-footer',
  imports: [LanguageSelector, RouterLink, RouterLinkActive, ThemeToggle],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  readonly showPreferences = input(false);
  protected readonly i18n = inject(I18nService);
  protected readonly currentYear = new Date().getFullYear();
}
