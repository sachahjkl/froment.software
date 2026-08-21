import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

const loginModeView = {
  client: {
    intro: 'backOffice.intro.client',
    panelLabelId: 'client-tab',
    route: '/backoffice/client',
  },
  administrator: {
    intro: 'backOffice.intro.administrator',
    panelLabelId: 'administrator-tab',
    route: '/backoffice/dashboard',
  },
} as const satisfies Record<
  LoginModeValue,
  {
    readonly intro: TranslationKey;
    readonly panelLabelId: string;
    readonly route: string;
  }
>;

@Component({
  selector: 'app-login',
  imports: [Button, RouterLink, Tabs],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly mode = signal<LoginModeValue>('client');
  protected readonly modeTabs = computed<readonly TabItem[]>(() => [
    {
      value: 'client',
      queryValue: 'client',
      id: 'client-tab',
      label: this.i18n.t('backOffice.mode.client'),
      panelId: 'login-panel',
    },
    {
      value: 'administrator',
      queryValue: 'admin',
      id: 'administrator-tab',
      label: this.i18n.t('backOffice.mode.administrator'),
      panelId: 'login-panel',
    },
  ]);
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
}
