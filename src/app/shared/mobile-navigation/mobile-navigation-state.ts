import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  effect,
  inject,
  Injectable,
  InjectionToken,
  Injector,
  Provider,
  signal,
  WritableSignal,
} from '@angular/core';

export interface MobileNavigationState {
  readonly open: WritableSignal<boolean>;
  close(): void;
  toggle(trigger: HTMLElement): void;
}

export const MOBILE_NAVIGATION = new InjectionToken<MobileNavigationState>('MOBILE_NAVIGATION');

@Injectable()
export class MobileNavigationController implements MobileNavigationState {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private trigger: HTMLElement | null = null;
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
    if (!this.open()) {
      return;
    }

    this.open.set(false);
    const trigger = this.trigger;
    afterNextRender(() => trigger?.focus(), { injector: this.injector });
  }

  toggle(trigger: HTMLElement): void {
    if (this.open()) {
      this.close();
      return;
    }

    this.trigger = trigger;
    this.open.set(true);
  }
}

export function provideMobileNavigation(): Provider {
  return { provide: MOBILE_NAVIGATION, useClass: MobileNavigationController };
}
