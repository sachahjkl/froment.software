import { Dialog, DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [Button],
  templateUrl: './confirmation.html',
  styleUrl: './confirmation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly message = inject<string>(DIALOG_DATA);
  protected readonly dialog = inject<DialogRef<boolean>>(DialogRef);
}

@Injectable({ providedIn: 'root' })
export class Confirmation {
  private readonly dialogs = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private active: DialogRef<boolean, ConfirmationDialog> | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.active?.close(false));
  }

  async request(message: string): Promise<boolean> {
    // Reject concurrent requests. One approval must authorize only one action.
    if (this.active !== undefined || this.destroyRef.destroyed) return false;
    const dialog = this.dialogs.open<boolean, string, ConfirmationDialog>(ConfirmationDialog, {
      data: message,
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
    });
    this.active = dialog;
    try {
      return (await firstValueFrom(dialog.closed, { defaultValue: false })) === true;
    } finally {
      this.active = undefined;
    }
  }
}
