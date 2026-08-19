import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { Button } from '../../shared/button/button';

@Component({
  selector: 'app-back-office-login',
  imports: [Button],
  templateUrl: './back-office-login.html',
  styleUrl: './back-office-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeLogin {
  private readonly auth = inject(BackOfficeAuth);
  private readonly router = inject(Router);
  protected readonly error = signal(false);
  protected readonly pending = signal(false);

  async submit(event: SubmitEvent, password: string): Promise<void> {
    event.preventDefault();
    this.pending.set(true);
    this.error.set(false);

    if (await this.auth.authenticate(password)) {
      await this.router.navigateByUrl('/back-office/dashboard');
      return;
    }

    this.pending.set(false);
    this.error.set(true);
  }
}
