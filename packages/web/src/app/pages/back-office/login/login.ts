import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type LoginModeValue } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-login',
  imports: [Button, RouterLink],
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
  protected readonly pending = signal(false);
  protected readonly submitLabel = computed<TranslationKey>(() => {
    if (this.pending()) return 'backOffice.pending';
    return 'backOffice.submit';
  });

  async submit(event: SubmitEvent, email: string, password: string): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(undefined);

    const outcome = await this.auth.authenticate(email, password);
    if (outcome.success) {
      await this.router.navigateByUrl(this.destination(outcome.mode));
      return;
    }

    this.pending.set(false);
    this.error.set(outcome.code);
  }

  private destination(mode: LoginModeValue): string {
    const fallback = mode === 'client' ? '/backoffice/client' : '/backoffice/dashboard';
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (mode !== 'client' || returnUrl === null) return fallback;
    if (returnUrl === '/backoffice/client' || returnUrl.startsWith('/backoffice/client?')) {
      return returnUrl;
    }
    return fallback;
  }
}
