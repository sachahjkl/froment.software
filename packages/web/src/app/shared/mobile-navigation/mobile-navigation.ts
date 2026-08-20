import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { MOBILE_NAVIGATION } from './mobile-navigation-state';
import { LanguageSelector } from '../language-selector/language-selector';

@Component({
  selector: 'app-mobile-navigation',
  imports: [LanguageSelector, RouterLink, RouterLinkActive],
  templateUrl: './mobile-navigation.html',
  styleUrl: './mobile-navigation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown)': 'trapFocus($event)',
  },
})
export class MobileNavigation {
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(MOBILE_NAVIGATION);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private wasOpen = false;

  constructor() {
    afterRenderEffect({
      write: () => {
        const open = this.navigation.open();
        if (open && !this.wasOpen) {
          const dialog = this.dialog().nativeElement;
          if (!dialog.open) dialog.showModal();
          this.closeButton().nativeElement.focus();
        } else if (!open && this.wasOpen) {
          const dialog = this.dialog().nativeElement;
          dialog.close();
        }
        this.wasOpen = open;
      },
    });
  }

  protected trapFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      this.dialog().nativeElement.querySelectorAll<HTMLElement>('a[href], button, select'),
    ).filter(
      (element) =>
        !(element instanceof HTMLButtonElement || element instanceof HTMLSelectElement) ||
        !element.disabled,
    );
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) {
      return;
    }

    const activeElement = this.element.nativeElement.ownerDocument.activeElement;
    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected close(): void {
    this.navigation.close();
  }
}
