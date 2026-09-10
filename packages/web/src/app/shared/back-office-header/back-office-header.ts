import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { type CurrentAccountValue } from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Button } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';
import { Drawer } from '@shared/drawer/drawer';
import { LanguageSelector } from '@shared/language-selector/language-selector';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';
import { GlobalSearch } from '@shared/global-search/global-search';

@Component({
  selector: 'app-back-office-header',
  imports: [
    BackOfficeNav,
    Button,
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    RouterLink,
    Icon,
    Drawer,
    NgTemplateOutlet,
    LanguageSelector,
    ThemeToggle,
    GlobalSearch,
  ],
  templateUrl: './back-office-header.html',
  styleUrl: './back-office-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeHeader {
  protected readonly accountControlHeight = '3.75rem';
  readonly administrator = input(false);
  readonly searchShortcut = input(true);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly account = signal<CurrentAccountValue | undefined>(undefined);
  protected readonly accountLoading = signal(true);
  protected readonly drawerOpen = signal(false);
  private readonly accountMenus = viewChildren(CdkMenuTrigger);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      void this.loadAccount();
      const desktop = window.matchMedia('(min-width: 64rem)');
      const resize = () => {
        if (desktop.matches) this.drawerOpen.set(false);
      };
      desktop.addEventListener('change', resize);
      this.destroyRef.onDestroy(() => desktop.removeEventListener('change', resize));
    });
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.drawerOpen.set(false);
        for (const menu of this.accountMenus()) menu.close();
      });
  }

  protected async loadAccount(): Promise<void> {
    this.accountLoading.set(true);
    this.account.set(await this.auth.currentAccount());
    this.accountLoading.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.router.navigateByUrl('/backoffice/sign-out');
  }
}
