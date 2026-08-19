import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TextCopy } from './text-copy';

@Injectable({
  providedIn: 'root',
})
export class AnchorCopy {
  private readonly document = inject(DOCUMENT);
  private readonly textCopy = inject(TextCopy);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  readonly message = signal<string | null>(null);

  async copy(fragment: string, message: string): Promise<void> {
    const location = this.document.defaultView?.location;
    if (!location) {
      return;
    }

    const url = `${location.origin}${location.pathname}${location.search}#${fragment}`;

    if (!(await this.textCopy.copy(url))) return;

    clearTimeout(this.hideTimer);
    this.message.set(message);
    this.hideTimer = setTimeout(() => this.message.set(null), 2400);
  }
}
