import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { type AccountSessionListValue } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';

@Component({
  selector: 'app-account-sessions',
  imports: [Button, Notice],
  templateUrl: './account-sessions.html',
  styleUrl: './account-sessions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSessions {
  private readonly confirmation = inject(Confirmation);
  readonly disabled = input(false);
  protected readonly i18n = inject(I18nService);
  private readonly authentication = inject(Authentication);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly revokeStatus = viewChild('revokeStatus', { read: ElementRef<HTMLElement> });
  protected readonly sessions = signal<AccountSessionListValue>([]);
  protected readonly loading = signal(true);
  protected readonly revoking = signal<string | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly revoked = signal(false);

  constructor() {
    afterNextRender(() => {
      void this.reload();
    });
  }

  protected async reload(): Promise<void> {
    if (this.revoking() !== undefined || this.disabled()) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.authentication.listSessions();
      if (this.destroyRef.destroyed) return;
      if (outcome.success) this.sessions.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      this.error.set('authentication.error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async revoke(session: AccountSessionListValue[number]): Promise<void> {
    if (session.current || this.revoking() !== undefined || this.loading() || this.disabled())
      return;
    if (
      !(await this.confirmation.request(
        this.i18n.tf('account.session_revoke_confirm', {
          date: this.date(session.startedAt),
          id: session.id,
        }),
      ))
    )
      return;
    this.revoking.set(session.id);
    this.error.set(undefined);
    this.revoked.set(false);
    try {
      const outcome = await this.authentication.revokeSession(session.id);
      if (this.destroyRef.destroyed) return;
      if (outcome.success) {
        this.sessions.update((sessions) => sessions.filter((entry) => entry.id !== session.id));
        this.revoked.set(true);
        afterNextRender(() => this.revokeStatus()?.nativeElement.focus(), {
          injector: this.injector,
        });
      } else this.error.set(outcome.code);
    } catch {
      this.error.set('authentication.error');
    } finally {
      this.revoking.set(undefined);
    }
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value));
  }
}
