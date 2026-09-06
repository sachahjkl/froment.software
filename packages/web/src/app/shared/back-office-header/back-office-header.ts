import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type CurrentAccountValue } from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-back-office-header',
  imports: [BackOfficeNav, Button, RouterLink],
  templateUrl: './back-office-header.html',
  styleUrl: './back-office-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeAccountOutside($event)',
    '(document:keydown.escape)': 'closeAccountWithEscape($event)',
  },
})
export class BackOfficeHeader {
  readonly administrator = input(false);
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly account = signal<CurrentAccountValue | undefined>(undefined);
  private readonly accountDisclosure =
    viewChild<ElementRef<HTMLDetailsElement>>('accountDisclosure');

  protected closeAccountOutside(event: MouseEvent): void {
    const disclosure = this.accountDisclosure()?.nativeElement;
    if (disclosure?.open && !event.composedPath().includes(disclosure)) disclosure.open = false;
  }

  protected closeAccountWithEscape(event: Event): void {
    const disclosure = this.accountDisclosure()?.nativeElement;
    if (!disclosure?.open) return;
    disclosure.open = false;
    disclosure.querySelector('summary')?.focus();
    event.preventDefault();
  }

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
