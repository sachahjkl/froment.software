import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  AuthenticationFailure,
  AccessToken,
  type AuthenticationFailureValue,
  type LoginModeValue,
  LoginRequest,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { decodeApiFailure, type ApiFailure } from '@shared/api-outcome';
import { AccessTokenStore } from './access-token-store';

export type AuthenticationOutcome =
  | { readonly success: true; readonly mode: LoginModeValue }
  | ApiFailure<AuthenticationFailureValue, 'authentication.error'>;

@Injectable({ providedIn: 'root' })
export class Authentication {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly tokens = inject(AccessTokenStore);

  async sessionMode(): Promise<LoginModeValue | undefined> {
    if (!this.isBrowser) return undefined;
    try {
      return this.tokens.mode() ?? (await this.tokens.refresh());
    } catch {
      return undefined;
    }
  }

  async authenticate(email: string, password: string): Promise<AuthenticationOutcome> {
    if (!this.isBrowser) return { success: false, code: 'authentication.error' };
    let request: typeof LoginRequest.Type;
    try {
      request = Schema.decodeUnknownSync(LoginRequest)({ email, password });
    } catch {
      return { success: false, code: 'authentication.invalid_credentials' };
    }

    try {
      const response = await firstValueFrom(this.http.post<unknown>('/api/auth/login', request));
      const session = Schema.decodeUnknownSync(AccessToken)(response);
      this.tokens.set(session);
      return { success: true, mode: session.mode };
    } catch (error) {
      return decodeApiFailure({ cause: error }, AuthenticationFailure, 'authentication.error');
    }
  }

  async signOut(): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/logout', undefined));
      this.tokens.clear();
      return true;
    } catch {
      this.tokens.clear();
      return false;
    }
  }
}

export const administratorGuard = async () => {
  const auth = inject(Authentication);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'administrator') return true;
  return router.createUrlTree(['/backoffice/login']);
};

export const clientGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Authentication);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'client') return true;
  return router.createUrlTree(['/backoffice/login'], {
    queryParams: { returnUrl: state.url },
  });
};
