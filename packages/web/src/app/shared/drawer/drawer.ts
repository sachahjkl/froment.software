import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { Button } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';

@Component({
  imports: [Button, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-drawer',
  styleUrl: './drawer.scss',
  templateUrl: './drawer.html',
})
export class Drawer {
  readonly open = input(false);
  readonly label = input.required<string>();
  readonly closeLabel = input.required<string>();
  readonly closeButtonHeight = input<string>();
  readonly closed = output<void>();
  private readonly dialogs = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly destroyRef = inject(DestroyRef);
  private readonly content = viewChild.required<TemplateRef<unknown>>('content');
  private active: DialogRef | undefined;

  constructor() {
    this.destroyRef.onDestroy(() => this.active?.close());
    afterRenderEffect(() => {
      if (this.open() && this.active === undefined) {
        const dialog = this.dialogs.open(this.content(), {
          ariaLabel: this.label(),
          autoFocus: '[data-drawer-close]',
          restoreFocus: true,
          closeOnNavigation: false,
          disableAnimations: true,
          width: '21rem',
          maxWidth: 'calc(100vw - 1.25rem)',
          height: '100dvh',
          positionStrategy: this.overlay.position().global().start('0').top('0'),
        });
        this.active = dialog;
        dialog.closed.subscribe(() => {
          this.active = undefined;
          if (!this.destroyRef.destroyed) this.closed.emit();
        });
      }
      if (!this.open()) this.active?.close();
    });
  }
}
