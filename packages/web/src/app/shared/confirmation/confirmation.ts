import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Predicate } from 'effect';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

interface ConfirmationOptions {
  readonly acceptLabel?: string;
  readonly variant?: 'primary' | 'danger';
}
interface ConfirmationData extends ConfirmationOptions {
  readonly message: string;
  readonly secretLabel?: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  imports: [Button],
  templateUrl: './confirmation.html',
  styleUrl: './confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject<ConfirmationData>(DIALOG_DATA);
  protected readonly dialog = inject<DialogRef<boolean | string>>(DialogRef);
  protected readonly secret = signal('');
}

@Injectable({ providedIn: 'root' })
export class Confirmation {
  private readonly dialogs = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private active: DialogRef<boolean | string, ConfirmationDialog> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.active?.close(false));
  }

  async request(message: string, options: ConfirmationOptions = {}): Promise<boolean> {
    // Reject concurrent requests. One approval must authorize only one action.
    if (this.active !== undefined || this.destroyRef.destroyed) return false;
    const dialog = this.dialogs.open<boolean | string, ConfirmationData, ConfirmationDialog>(
      ConfirmationDialog,
      {
        data: { message, ...options },
        role: 'alertdialog',
        ariaModal: true,
        ariaLabelledBy: 'confirmation-title',
        ariaDescribedBy: 'confirmation-message',
        autoFocus: '[data-confirmation-cancel]',
        restoreFocus: true,
        hasBackdrop: true,
        disableClose: false,
        disableAnimations: true,
        width: '30rem',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    this.active = dialog;
    try {
      return (await firstValueFrom(dialog.closed, { defaultValue: false })) === true;
    } finally {
      this.active = undefined;
    }
  }

  async requestSecret(
    message: string,
    secretLabel: string,
    options: ConfirmationOptions = {},
  ): Promise<string | undefined> {
    if (this.active !== undefined || this.destroyRef.destroyed) return undefined;
    const dialog = this.dialogs.open<boolean | string, ConfirmationData, ConfirmationDialog>(
      ConfirmationDialog,
      {
        data: { message, secretLabel, ...options },
        role: 'alertdialog',
        ariaModal: true,
        ariaLabelledBy: 'confirmation-title',
        ariaDescribedBy: 'confirmation-message',
        autoFocus: '[data-confirmation-secret]',
        restoreFocus: true,
        hasBackdrop: true,
        disableClose: false,
        disableAnimations: true,
        width: '30rem',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    this.active = dialog;
    try {
      const result = await firstValueFrom(dialog.closed, { defaultValue: false });
      return Predicate.isString(result) && result.length > 0 ? result : undefined;
    } finally {
      this.active = undefined;
    }
  }
}
