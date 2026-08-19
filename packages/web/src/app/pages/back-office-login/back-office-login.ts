import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { I18nService, TranslationKey } from '../../i18n.service';
import { Button } from '../../shared/button/button';

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
  protected readonly pending = signal(false);

  async submit(event: SubmitEvent, accessIdentifier: string): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(undefined);

    const outcome = await this.auth.authenticate(accessIdentifier);
    if (outcome.success) {
      await this.router.navigateByUrl('/back-office/dashboard');
      return;
    }

    this.pending.set(false);
    this.error.set(outcome.code);
  }
}
