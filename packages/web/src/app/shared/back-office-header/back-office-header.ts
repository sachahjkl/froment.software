import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type CurrentAccountValue } from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Button } from '@shared/button/button';
import { LanguageSelector } from '@shared/language-selector/language-selector';
import { ThemeToggle } from '@shared/theme-toggle/theme-toggle';

@Component({
  selector: 'app-back-office-header',
  imports: [BackOfficeNav, Button, LanguageSelector, RouterLink, ThemeToggle],
  templateUrl: './back-office-header.html',
  styleUrl: './back-office-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeHeader {
  readonly administrator = input(false);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly account = signal<CurrentAccountValue | undefined>(undefined);

  constructor() {
    void this.loadAccount();
  }

  private async loadAccount(): Promise<void> {
    this.account.set(await this.auth.currentAccount());
  }

  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) void this.router.navigateByUrl('/backoffice/login');
  }
}
