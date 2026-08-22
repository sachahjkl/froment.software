import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, InjectionToken, PLATFORM_ID } from '@angular/core';

export const AUTH_COOKIE_LOCK_MANAGER = new InjectionToken<LockManager | undefined>(
  'AUTH_COOKIE_LOCK_MANAGER',
  {
    providedIn: 'root',
    factory: () => (isPlatformBrowser(inject(PLATFORM_ID)) ? navigator.locks : undefined),
  },
);

@Injectable({ providedIn: 'root' })
export class AuthCookieLock {
  private readonly manager = inject(AUTH_COOKIE_LOCK_MANAGER);

  run<A>(operation: () => Promise<A>): Promise<A> {
    return this.manager?.request('froment-auth-cookie', operation) ?? operation();
  }
}
