import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { I18nService, TranslationKey } from '../../i18n.service';
import { Button } from '../../shared/button/button';

const loginModeView = {
  client: {
    intro: 'backOffice.intro.client',
    panelLabelId: 'client-tab',
    queryMode: 'client',
    route: '/backoffice/client',
  },
  administrator: {
    intro: 'backOffice.intro.administrator',
    panelLabelId: 'administrator-tab',
    queryMode: 'admin',
    route: '/backoffice/dashboard',
  },
} as const satisfies Record<
  LoginModeValue,
  {
    readonly intro: TranslationKey;
    readonly panelLabelId: string;
    readonly queryMode: 'admin' | 'client';
    readonly route: string;
  }
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly mode = signal<LoginModeValue>('client');
  protected readonly modeView = computed(() => loginModeView[this.mode()]);
  protected readonly pending = signal(false);
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.pending()) return 'backOffice.pending';
    return 'backOffice.submit';
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((parameters) => {
      this.applyQueryMode(parameters.get('mode'));
    });
  }

  selectMode(mode: LoginModeValue, tab?: HTMLButtonElement): void {
    this.mode.set(mode);
    this.error.set(undefined);
    tab?.focus();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mode: loginModeView[mode].queryMode },
      replaceUrl: true,
    });
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

  private applyQueryMode(mode: string | null): void {
    if (mode === 'admin') {
      this.mode.set('administrator');
      return;
    }
    if (mode === 'client') {
      this.mode.set('client');
      return;
    }
    this.selectMode('client');
  }
}
