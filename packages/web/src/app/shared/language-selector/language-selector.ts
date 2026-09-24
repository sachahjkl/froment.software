import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { isSupportedLanguage } from '@froment/l10n';
import { I18nService } from '@app/i18n.service';
import { localizedUrl } from '@app/localized-route';

@Component({
  selector: 'app-language-selector',
  imports: [],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.compact]': 'compact()',
  },
})
export class LanguageSelector {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  readonly compact = input(false);

  protected changeLanguage(event: Event): void {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !isSupportedLanguage(select.value)) return;

    const url = localizedUrl(this.router.url, select.value);
    if (url === this.router.url) return;

    void this.router.navigateByUrl(url, { replaceUrl: true, scroll: 'manual' });
  }
}
