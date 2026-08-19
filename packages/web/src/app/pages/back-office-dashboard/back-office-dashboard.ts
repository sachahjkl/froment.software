import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { I18nService } from '../../i18n.service';
import { Button } from '../../shared/button/button';

@Component({
  selector: 'app-back-office-dashboard',
  imports: [Button, RouterLink],
  templateUrl: './back-office-dashboard.html',
  styleUrl: './back-office-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeDashboard {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(BackOfficeAuth);
  private readonly router = inject(Router);

  async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      void this.router.navigateByUrl('/back-office');
    }
  }
}
