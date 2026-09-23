import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { EnvironmentStatus } from '@shared/environment-status/environment-status';
import { LanguageSelector } from '@shared/language-selector/language-selector';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';

@Component({
  selector: 'app-site-footer',
  imports: [EnvironmentStatus, LanguageSelector, RouterLink, ThemeToggle],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly i18n = inject(I18nService);
  protected readonly currentYear = new Date().getFullYear();
}
