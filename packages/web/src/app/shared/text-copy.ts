import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TextCopy {
  private readonly document = inject(DOCUMENT);

  async copy(value: string): Promise<boolean> {
    try {
      const clipboard = this.document.defaultView?.navigator.clipboard;
      if (clipboard === undefined) throw new Error('clipboard_unavailable');
      await clipboard.writeText(value);
      return true;
    } catch {
      const input = this.document.createElement('textarea');
      input.value = value;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      this.document.body.appendChild(input);
      input.select();
      const copied = this.document.execCommand('copy');
      input.remove();
      return copied;
    }
  }
}
