import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { I18nService, TranslationKey } from '../../i18n.service';
import { Button } from '../../shared/button/button';

const loginModeView = {
  client: {
    intro: 'backOffice.intro.client',
    panelLabelId: 'client-tab',
    route: '/back-office/business-card',
  },
  administrator: {
    intro: 'backOffice.intro.administrator',
    panelLabelId: 'administrator-tab',
    route: '/back-office/dashboard',
  },
} as const satisfies Record<
  LoginModeValue,
  { readonly intro: TranslationKey; readonly panelLabelId: string; readonly route: string }
>;

@Component({
  selector: 'app-back-office-login',
  imports: [Button, RouterLink],
  templateUrl: './back-office-login.html',
  styleUrl: './back-office-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeLogin {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(BackOfficeAuth);
  private readonly router = inject(Router);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly mode = signal<LoginModeValue>('client');
  protected readonly modeView = computed(() => loginModeView[this.mode()]);
  protected readonly pending = signal(false);
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.pending()) return 'backOffice.pending';
    return 'backOffice.submit';
  });

  selectMode(mode: LoginModeValue, tab?: HTMLButtonElement): void {
    this.mode.set(mode);
    this.error.set(undefined);
    tab?.focus();
  }

  async submit(event: SubmitEvent, accessIdentifier: string): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(undefined);

    const mode = this.mode();
    const route = this.modeView().route;
    const outcome = await this.auth.authenticate(accessIdentifier, mode);
    if (outcome.success) {
      await this.router.navigateByUrl(route);
      return;
    }

    this.pending.set(false);
    this.error.set(outcome.code);
  }

  tabIndex(mode: LoginModeValue): 0 | -1 {
    if (this.mode() === mode) return 0;
    return -1;
  }
}
