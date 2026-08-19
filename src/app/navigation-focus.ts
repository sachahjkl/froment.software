import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, effect, inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationFocus {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );
  private initialNavigationComplete = this.router.navigated;

  constructor() {
    effect(() => {
      const navigation = this.navigationEnd();
      if (!navigation) return;
      if (!this.initialNavigationComplete) {
        this.initialNavigationComplete = true;
        return;
      }
      const fragment = this.router.parseUrl(navigation.urlAfterRedirects).fragment;
      if (fragment) {
        this.focusFragment(fragment);
      } else {
        this.focusMainAfterRender();
      }
    });
  }

  private focusFragment(fragment: string): void {
    if (!this.isBrowser) return;
    afterNextRender(
      () => {
        const target = this.document.getElementById(fragment);
        if (!target) return this.focusMain();
        const focusTarget = target.matches('h1, h2, h3, h4, h5, h6, [role="heading"]')
          ? target
          : (target.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]') ??
            target);
        this.focusElement(focusTarget);
      },
      { injector: this.injector },
    );
  }

  private focusElement(element: HTMLElement): void {
    const temporary =
      !element.hasAttribute('tabindex') &&
      !element.matches(
        'a[href], area[href], button, input, select, textarea, iframe, [contenteditable="true"]',
      );
    if (temporary) element.tabIndex = -1;
    element.focus({ preventScroll: true });
    if (temporary) {
      if (this.document.activeElement !== element) return element.removeAttribute('tabindex');
      element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
    }
  }

  private focusMain(): void {
    this.document.getElementById('main-content')?.focus({ preventScroll: true });
  }

  private focusMainAfterRender(): void {
    if (this.isBrowser) afterNextRender(() => this.focusMain(), { injector: this.injector });
  }
}
