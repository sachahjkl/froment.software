import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './i18n.service';
import { NavigationFocus } from './navigation-focus';
import { PageMetadata } from './page-metadata';
import { CopyNotice } from './shared/copy-notice/copy-notice';
import { SiteFooter } from './shared/site-footer/site-footer';
import { SiteHeader } from './shared/site-header/site-header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CopyNotice, RouterOutlet, SiteFooter, SiteHeader],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);

  constructor() {
    inject(NavigationFocus);
    inject(PageMetadata);
  }
}
