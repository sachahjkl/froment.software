import { inject, Injectable } from '@angular/core';
import { type Navigation, Router } from '@angular/router';
import type { CurrentAccountValue } from '@froment/contracts';
import type { Authentication } from './authentication';

@Injectable({ providedIn: 'root' })
export class RouteAccount {
  private authentication: Authentication | undefined;
  private readonly router = inject(Router);
  private navigation: Navigation | null = null;
  private request: Promise<CurrentAccountValue | undefined> | undefined;

  load(authentication: Authentication): Promise<CurrentAccountValue | undefined> {
    const navigation = this.router.currentNavigation();
    if (
      navigation !== null &&
      this.navigation === navigation &&
      this.authentication === authentication &&
      this.request !== undefined
    )
      return this.request;
    this.navigation = navigation;
    this.authentication = authentication;
    this.request = authentication.refreshAccount();
    return this.request;
  }
}
