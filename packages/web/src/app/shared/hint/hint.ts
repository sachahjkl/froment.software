import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';

@Component({
  imports: [],
  selector: 'app-hint',
  styleUrl: './hint.scss',
  templateUrl: './hint.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.anchor-name]': 'anchorName',
    '(pointerenter)': 'enter($event)',
    '(pointerleave)': 'leave()',
    '(focusin)': 'focusIn()',
    '(focusout)': 'focusOut()',
  },
})
export class Hint {
  readonly text = input.required<string>();
  readonly id = inject(_IdGenerator).getId('hint-');
  protected readonly anchorName = `--${this.id}`;
  private readonly document = inject(DOCUMENT);
  private readonly bubble = viewChild.required<ElementRef<HTMLElement>>('bubble');
  private hovered = false;
  private focused = false;
  private visible = false;
  private dismissed = false;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.dismiss(event);
  };

  constructor() {
    // Fermez l’infobulle avant que le dialogue parent traite Échap.
    this.document.addEventListener('keydown', this.onKeydown, true);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.hideTimer);
      this.document.removeEventListener('keydown', this.onKeydown, true);
    });
  }

  protected enter(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    this.hovered = true;
    this.show();
  }

  protected leave(): void {
    this.hovered = false;
    this.scheduleHide();
  }

  protected focusIn(): void {
    this.focused = true;
    this.show();
  }

  protected focusOut(): void {
    this.focused = false;
    this.scheduleHide();
  }

  private dismiss(event: KeyboardEvent): void {
    if (!this.visible) return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissed = true;
    this.hide();
  }

  protected beforeToggle(event: Event): void {
    if (event instanceof ToggleEvent) this.visible = event.newState === 'open';
  }

  private show(): void {
    clearTimeout(this.hideTimer);
    if (this.dismissed || this.visible || !this.text()) return;
    this.bubble().nativeElement.showPopover();
    this.visible = true;
  }

  private scheduleHide(): void {
    if (this.hovered || this.focused) return;
    this.dismissed = false;
    clearTimeout(this.hideTimer);
    // Gardez le passage entre le bouton et l’infobulle accessible au pointeur.
    this.hideTimer = setTimeout(() => this.hide(), 150);
  }

  private hide(): void {
    clearTimeout(this.hideTimer);
    if (!this.visible) return;
    this.bubble().nativeElement.hidePopover();
    this.visible = false;
  }
}
