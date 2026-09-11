import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  TransferState,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouterOutlet,
  RoutesRecognized,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { APP_SHELL_STATE, routeShell } from './app-shell';
import { I18nService } from './i18n.service';
import { NavigationFocus } from './navigation-focus';
import { PageMetadata } from './page-metadata';
import { CopyNotice } from './shared/copy-notice/copy-notice';
import { SiteFooter } from './shared/site-footer/site-footer';
import { SiteHeader } from './shared/site-header/site-header';
import { BackOfficeHeader } from './shared/back-office-header/back-office-header';
import { BackOfficeHeaderPlaceholder } from './shared/back-office-header/back-office-header-placeholder';
import { Button } from './shared/button/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    BackOfficeHeader,
    BackOfficeHeaderPlaceholder,
    Button,
    CopyNotice,
    RouterOutlet,
    SiteFooter,
    SiteHeader,
  ],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly transferState = inject(TransferState);
  private readonly initialShell = this.router.navigated
    ? routeShell(this.router.routerState.snapshot.root)
    : this.transferState.get(APP_SHELL_STATE, undefined);
  private readonly shell = signal(this.initialShell);
  protected readonly startup = signal<'loading' | 'ready' | 'error'>(
    this.initialShell === undefined ? 'loading' : 'ready',
  );
  protected readonly backOffice = computed(
    () => this.shell() === 'administrator' || this.shell() === 'client',
  );
  protected readonly administrator = computed(() => this.shell() === 'administrator');
  protected readonly standalonePage = computed(() => this.shell() === 'standalone');
  protected readonly publicPage = computed(() => this.shell() === 'public');

  constructor() {
    inject(NavigationFocus);
    inject(PageMetadata);
    this.transferState.onSerialize(APP_SHELL_STATE, () => this.shell());
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.shell.set(routeShell(this.router.routerState.snapshot.root));
        this.startup.set('ready');
      } else if (this.startup() !== 'ready') {
        if (event instanceof RoutesRecognized) {
          this.shell.set(routeShell(event.state.root));
          this.startup.set('loading');
        } else if (event instanceof NavigationStart) {
          this.startup.set('loading');
        } else if (
          event instanceof NavigationError ||
          event instanceof NavigationSkipped ||
          (event instanceof NavigationCancel &&
            event.code !== NavigationCancellationCode.Redirect &&
            event.code !== NavigationCancellationCode.SupersededByNewNavigation)
        ) {
          this.startup.set('error');
        }
      }
    });
  }

  protected reload(): void {
    this.document.defaultView?.location.reload();
  }
}
