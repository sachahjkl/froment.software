import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const accessHash =
  '68c8f0e508e8ce25e06cd45601852da772a9b78d80ed4f55d3d9eb72f24b1aec8b44fa6aa24e07b155542d00c6cdd3df39b232f65385a84c8db45932f608f6ac';
const sessionKey = 'froment-back-office';

@Injectable({ providedIn: 'root' })
export class BackOfficeAuth {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  isAuthenticated(): boolean {
    return this.isBrowser && sessionStorage.getItem(sessionKey) === accessHash;
  }

  async authenticate(password: string): Promise<boolean> {
    if (!this.isBrowser || !password) {
      return false;
    }

    const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(password));
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    if (hash !== accessHash) {
      return false;
    }

    sessionStorage.setItem(sessionKey, accessHash);
    return true;
  }

  signOut(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem(sessionKey);
    }
  }
}

export const backOfficeGuard: CanActivateFn = () => {
  const auth = inject(BackOfficeAuth);
  return auth.isAuthenticated() || inject(Router).createUrlTree(['/back-office']);
};
