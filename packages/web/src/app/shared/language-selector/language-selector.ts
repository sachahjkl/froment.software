import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { I18nService } from '../../i18n.service';

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
  readonly compact = input(false);

  protected setLanguage(language: string): void {
    this.i18n.setLanguage(language);
  }
}
