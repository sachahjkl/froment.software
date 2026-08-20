import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import {
  AccessIdentifier,
  AuthenticationFailure,
  type AuthenticationFailureValue,
  type LoginModeValue,
  SessionStatus,
  type AccessIdentifierValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { decodeApiFailure, type ApiFailure } from '@shared/api-outcome';

export type AuthenticationOutcome =
  | { readonly success: true }
  | ApiFailure<AuthenticationFailureValue, 'authentication.error'>;

@Injectable({ providedIn: 'root' })
export class Authentication {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async sessionMode(): Promise<LoginModeValue | undefined> {
    if (!this.isBrowser) return undefined;
    try {
      const response = await firstValueFrom(this.http.get<unknown>('/api/auth/session'));
      const session = Schema.decodeUnknownSync(SessionStatus)(response);
      if (!session.authenticated) return undefined;
      return session.mode;
    } catch {
      return undefined;
    }
  }

  async authenticate(
    accessIdentifier: string,
    mode: LoginModeValue,
  ): Promise<AuthenticationOutcome> {
    if (!this.isBrowser) return { success: false, code: 'authentication.error' };
    let parsedIdentifier: AccessIdentifierValue;
    try {
      parsedIdentifier = Schema.decodeUnknownSync(AccessIdentifier)(accessIdentifier);
    } catch {
      return { success: false, code: 'authentication.invalid_credentials' };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<unknown>('/api/auth/login', { accessIdentifier: parsedIdentifier, mode }),
      );
      const session = Schema.decodeUnknownSync(SessionStatus)(response);
      if (session.authenticated && session.mode === mode) return { success: true };
      return { success: false, code: 'authentication.error' };
    } catch (error) {
      return decodeApiFailure({ cause: error }, AuthenticationFailure, 'authentication.error');
    }
  }

  async signOut(): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      const response = await firstValueFrom(this.http.post<unknown>('/api/auth/logout', undefined));
      return !Schema.decodeUnknownSync(SessionStatus)(response).authenticated;
    } catch {
      return false;
    }
  }
}

export const administratorGuard = async () => {
  const auth = inject(Authentication);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'administrator') return true;
  return router.createUrlTree(['/backoffice/login'], { queryParams: { mode: 'admin' } });
};

export const clientGuard = async () => {
  const auth = inject(Authentication);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'client') return true;
  return router.createUrlTree(['/backoffice/login'], { queryParams: { mode: 'client' } });
};
