import { Confirmation } from '@shared/confirmation/confirmation';
import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import {
  disabled,
  form,
  FormField,
  minLength,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { accountPasswordConfig } from '@froment/contracts';
import { Authentication } from '@backoffice/authentication';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  selector: 'app-account-security',
  imports: [Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './account-security.html',
  styleUrl: './account-security.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurity {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly authentication = inject(Authentication);
  protected readonly pending = signal(false);
  protected readonly complete = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal({ currentPassword: '', newPassword: '', confirmation: '' });
  protected readonly passwordForm = form(this.model, (path) => {
    disabled(path, () => this.pending() || this.complete());
    required(path.currentPassword);
    required(path.newPassword);
    required(path.confirmation);
    minLength(path.newPassword, accountPasswordConfig.minLength);
    maxLength(path.newPassword, accountPasswordConfig.maxLength);
    maxLength(path.currentPassword, accountPasswordConfig.maxLength);
    validate(path.confirmation, ({ value, valueOf }) =>
      value() !== valueOf(path.newPassword) ? { kind: 'mismatch' } : undefined,
    );
  });

  protected changePassword(event: SubmitEvent): void {
    event.preventDefault();
    if (this.pending() || this.complete()) return;
    if (this.passwordForm().invalid()) {
      this.passwordForm().markAsTouched();
      this.passwordForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      this.error.set('configurationWorkspace.passwordInvalid');
      return;
    }
    void submit(this.passwordForm, async () => {
      this.pending.set(true);
      if (!(await this.confirmation.request(this.i18n.t('account.password_confirm')))) {
        this.pending.set(false);
        return;
      }
      this.error.set(undefined);
      try {
        const { currentPassword, newPassword } = this.model();
        const outcome = await this.authentication.changePassword({ currentPassword, newPassword });
        if (outcome.success) this.complete.set(true);
        else this.error.set(outcome.code);
      } catch {
        this.error.set('authentication.error');
      } finally {
        this.model.set({ currentPassword: '', newPassword: '', confirmation: '' });
        this.passwordForm().reset();
        this.pending.set(false);
      }
    });
  }

  async canDeactivate(): Promise<boolean> {
    if (this.pending()) return false;
    return (
      !this.passwordForm().dirty() ||
      (await this.confirmation.request(this.i18n.t('account.password_discard')))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.pending() || this.passwordForm().dirty()) event.preventDefault();
  }
}
