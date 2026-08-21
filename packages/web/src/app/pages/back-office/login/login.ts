import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';

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
  imports: [Button, RouterLink, RouterOutlet, TabLayout, TabPanel, Tabs],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly modeTabs = computed<readonly TabItem[]>(() => [
    {
      path: 'client',
      id: 'client-tab',
      label: this.i18n.t('backOffice.mode.client'),
    },
    {
      path: 'admin',
      id: 'administrator-tab',
      label: this.i18n.t('backOffice.mode.administrator'),
    },
  ]);
  protected readonly pending = signal(false);
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.pending()) return 'backOffice.pending';
    return 'backOffice.submit';
  });

  protected modeView(mode: LoginModeValue) {
    return loginModeView[mode];
  }

  async submit(event: SubmitEvent, accessIdentifier: string, mode: LoginModeValue): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(undefined);

    const route = this.destination(mode);
    const outcome = await this.auth.authenticate(accessIdentifier, mode);
    if (outcome.success) {
      await this.router.navigateByUrl(route);
      return;
    }

    this.pending.set(false);
    this.error.set(outcome.code);
  }

  private destination(mode: LoginModeValue): string {
    const fallback = this.modeView(mode).route;
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (mode !== 'client' || returnUrl === null) return fallback;
    if (returnUrl === '/backoffice/client' || returnUrl.startsWith('/backoffice/client?')) {
      return returnUrl;
    }
    return fallback;
  }
}
