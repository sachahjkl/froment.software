import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { MOBILE_NAVIGATION } from './mobile-navigation-state';
import { LanguageSelector } from '../language-selector/language-selector';

@Component({
  selector: 'app-mobile-navigation',
  imports: [LanguageSelector, RouterLink, RouterLinkActive],
  templateUrl: './mobile-navigation.html',
  styleUrl: './mobile-navigation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    id: 'mobile-navigation',
    '[class.open]': 'navigation.open()',
  },
})
export class MobileNavigation {
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(MOBILE_NAVIGATION);
}
