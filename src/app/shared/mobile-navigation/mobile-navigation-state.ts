import { DOCUMENT } from '@angular/common';
import {
  effect,
  inject,
  Injectable,
  InjectionToken,
  Provider,
  signal,
  WritableSignal,
} from '@angular/core';

export interface MobileNavigationState {
  readonly open: WritableSignal<boolean>;
  close(): void;
  toggle(): void;
}

export const MOBILE_NAVIGATION = new InjectionToken<MobileNavigationState>('MOBILE_NAVIGATION');

@Injectable()
export class MobileNavigationController implements MobileNavigationState {
  private readonly document = inject(DOCUMENT);
  readonly open = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }

      const rootOverflow = this.document.documentElement.style.overflow;
      const bodyOverflow = this.document.body.style.overflow;
      this.document.documentElement.style.overflow = 'hidden';
      this.document.body.style.overflow = 'hidden';
      onCleanup(() => {
        this.document.documentElement.style.overflow = rootOverflow;
        this.document.body.style.overflow = bodyOverflow;
      });
    });
  }

  close(): void {
    this.open.set(false);
  }

  toggle(): void {
    this.open.update((open) => !open);
  }
}

export function provideMobileNavigation(): Provider {
  return { provide: MOBILE_NAVIGATION, useClass: MobileNavigationController };
}
