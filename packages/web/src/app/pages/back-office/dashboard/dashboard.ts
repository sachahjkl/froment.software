import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-dashboard',
  imports: [Button, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      void this.router.navigateByUrl('/backoffice/login?mode=admin');
    }
  }
}
