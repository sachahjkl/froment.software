import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { I18nService } from './i18n.service';
import { NavigationFocus } from './navigation-focus';
import { PageMetadata } from './page-metadata';
import { CopyNotice } from './shared/copy-notice/copy-notice';
import { SiteFooter } from './shared/site-footer/site-footer';
import { SiteHeader } from './shared/site-header/site-header';
import { BackOfficeHeader } from './shared/back-office-header/back-office-header';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BackOfficeHeader, CopyNotice, RouterOutlet, SiteFooter, SiteHeader],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly backOffice = signal(false);
  protected readonly administrator = signal(false);

  constructor() {
    inject(NavigationFocus);
    inject(PageMetadata);
    this.updateShell(this.router.url);
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.updateShell(event.urlAfterRedirects));
  }

  private updateShell(url: string): void {
    const path = url.split(/[?#]/, 1)[0];
    const authenticated =
      path.startsWith('/backoffice/') &&
      path !== '/backoffice/login' &&
      path !== '/backoffice/bootstrap';
    this.backOffice.set(authenticated);
    this.administrator.set(authenticated && path !== '/backoffice/client');
  }
}
