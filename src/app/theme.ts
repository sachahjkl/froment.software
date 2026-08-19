import { DOCUMENT } from '@angular/common';
import { afterNextRender, inject, Injectable, Injector, signal } from '@angular/core';
import { Meta } from '@angular/platform-browser';

type ThemeName = 'light' | 'dark';
const storageKey = 'froment.software.theme';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly injector = inject(Injector);
  readonly current = signal<ThemeName>('light');

  constructor() {
    afterNextRender(() => this.apply(this.detect(), false), { injector: this.injector });
  }

  toggle(): void {
    this.apply(this.current() === 'dark' ? 'light' : 'dark');
  }

  private detect(): ThemeName {
    const window = this.document.defaultView;
    const storedTheme = window?.localStorage.getItem(storageKey);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private apply(theme: ThemeName, store = true): void {
    this.current.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
    this.meta.updateTag({ name: 'theme-color', content: theme === 'dark' ? '#17171f' : '#f3f2f6' });
    if (store) {
      this.document.defaultView?.localStorage.setItem(storageKey, theme);
    }
  }
}
