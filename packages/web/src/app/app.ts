import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { routeShell } from './app-shell';
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
  private readonly shell = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => routeShell(this.router.routerState.snapshot.root)),
    ),
    { initialValue: routeShell(this.router.routerState.snapshot.root) },
  );
  protected readonly backOffice = computed(
    () => this.shell() === 'administrator' || this.shell() === 'client',
  );
  protected readonly administrator = computed(() => this.shell() === 'administrator');
  protected readonly standalonePage = computed(() => this.shell() === 'standalone');

  constructor() {
    inject(NavigationFocus);
    inject(PageMetadata);
  }
}
