import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AnchorCopy {
  private readonly document = inject(DOCUMENT);
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  readonly message = signal<string | null>(null);

  async copy(fragment: string, message: string): Promise<void> {
    const location = this.document.defaultView?.location;
    if (!location) {
      return;
    }

    const url = `${location.origin}${location.pathname}${location.search}#${fragment}`;

    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (!clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await clipboard.writeText(url);
    } catch {
      const input = this.document.createElement('textarea');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      this.document.body.appendChild(input);
      input.select();
      this.document.execCommand('copy');
      input.remove();
    }

    clearTimeout(this.hideTimer);
    this.message.set(message);
    this.hideTimer = setTimeout(() => this.message.set(null), 2400);
  }
}
