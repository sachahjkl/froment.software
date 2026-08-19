import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '../../i18n.service';
import { Theme } from '../../theme';
import { MobileNavigation } from '../mobile-navigation/mobile-navigation';
import {
  MOBILE_NAVIGATION,
  provideMobileNavigation,
} from '../mobile-navigation/mobile-navigation-state';
import { NewLabel } from '../new-label/new-label';
import { LanguageSelector } from '../language-selector/language-selector';

@Component({
  selector: 'app-site-header',
  imports: [LanguageSelector, MobileNavigation, NewLabel, RouterLink, RouterLinkActive],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideMobileNavigation()],
  host: {
    '(document:click)': 'closeNavOnOutsideClick($event)',
    '[class.mobile-nav-open]': 'mobileNavigation.open()',
  },
})
export class SiteHeader {
  protected readonly i18n = inject(I18nService);
  protected readonly theme = inject(Theme);
  protected readonly mobileNavigation = inject(MOBILE_NAVIGATION);
  protected closeNavOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.mobile-navigation-control')) {
      return;
    }

    this.mobileNavigation.close();
  }
}
