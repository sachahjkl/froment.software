import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { BackOfficeAuth } from '@backoffice/back-office-auth';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-back-office-client',
  imports: [Button],
  templateUrl: './back-office-client.html',
  styleUrl: './back-office-client.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeClient {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(BackOfficeAuth);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      await this.router.navigateByUrl('/backoffice/login?mode=client');
    }
  }
}
