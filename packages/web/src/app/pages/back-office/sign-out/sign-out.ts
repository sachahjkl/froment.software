import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Authentication } from '@backoffice/authentication';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';

@Component({
  selector: 'app-sign-out',
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink],
  styleUrl: './sign-out.scss',
  templateUrl: './sign-out.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignOut {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  private readonly router = inject(Router);
  protected readonly pending = signal(true);
  protected readonly failed = signal(false);

  constructor() {
    afterNextRender(() => void this.signOut());
  }

  canDeactivate(): boolean {
    return !this.pending();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventPendingUnload(event: BeforeUnloadEvent): void {
    if (this.pending()) event.preventDefault();
  }

  protected async retry(): Promise<void> {
    if (!this.pending()) await this.signOut();
  }

  private async signOut(): Promise<void> {
    this.pending.set(true);
    this.failed.set(false);
    try {
      this.failed.set(!(await this.auth.signOut()));
    } catch {
      this.failed.set(true);
    }
    this.pending.set(false);
    if (!this.failed()) await this.router.navigateByUrl('/backoffice/login', { replaceUrl: true });
  }
}
