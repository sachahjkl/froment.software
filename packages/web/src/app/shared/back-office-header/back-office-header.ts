import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
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

@Component({
  selector: 'app-back-office-header',
  imports: [
    BackOfficeNav,
    Button,
    RouterLink,
    Icon,
    Drawer,
    NgTemplateOutlet,
    LanguageSelector,
    ThemeToggle,
  ],
  templateUrl: './back-office-header.html',
  styleUrl: './back-office-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeAccountOutside($event)',
  },
})
export class BackOfficeHeader {
  protected readonly accountControlHeight = '3.75rem';
  readonly administrator = input(false);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly account = signal<CurrentAccountValue | undefined>(undefined);
  protected readonly accountLoading = signal(true);
  protected readonly drawerOpen = signal(false);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected closeAccountOutside(event: MouseEvent): void {
    for (const disclosure of this.document.querySelectorAll<HTMLDetailsElement>(
      '.back-office-account',
    )) {
      if (disclosure.open && !event.composedPath().includes(disclosure)) disclosure.open = false;
    }
  }

  protected closeAccountWithEscape(event: Event, disclosure: HTMLDetailsElement): void {
    if (!disclosure.open) return;
    disclosure.open = false;
    disclosure.querySelector('summary')?.focus();
    event.preventDefault();
    event.stopPropagation();
  }

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
        for (const disclosure of this.document.querySelectorAll<HTMLDetailsElement>(
          '.back-office-account[open]',
        ))
          disclosure.open = false;
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
