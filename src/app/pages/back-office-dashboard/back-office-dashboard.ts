import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BackOfficeAuth } from '../../back-office/back-office-auth';
import { Button } from '../../shared/button/button';
import { LinkButton } from '../../shared/link-button/link-button';

@Component({
  selector: 'app-back-office-dashboard',
  imports: [Button, LinkButton, RouterLink],
  templateUrl: './back-office-dashboard.html',
  styleUrl: './back-office-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeDashboard {
  private readonly auth = inject(BackOfficeAuth);
  private readonly router = inject(Router);

  signOut(): void {
    this.auth.signOut();
    void this.router.navigateByUrl('/back-office');
  }
}
