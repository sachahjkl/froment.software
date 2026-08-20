import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-client-portal',
  imports: [Button],
  templateUrl: './client-portal.html',
  styleUrl: './client-portal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPortal {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      await this.router.navigateByUrl('/backoffice/login?mode=client');
    }
  }
}
