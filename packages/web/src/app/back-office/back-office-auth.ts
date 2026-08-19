import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import {
  AccessIdentifier,
  AuthenticationFailure,
  type AuthenticationFailureCode,
  type LoginModeValue,
  SessionStatus,
  type AccessIdentifierValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

export type AuthenticationOutcome =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly code: AuthenticationFailureCode | 'authentication.error';
    };

@Injectable({ providedIn: 'root' })
export class BackOfficeAuth {
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
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 429)) {
        try {
          const failure = Schema.decodeUnknownSync(AuthenticationFailure)(error.error);
          return { success: false, code: failure.code };
        } catch {
          return { success: false, code: 'authentication.error' };
        }
      }
      return { success: false, code: 'authentication.error' };
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

export const backOfficeAdministratorGuard = async () => {
  const auth = inject(BackOfficeAuth);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'administrator') return true;
  return router.createUrlTree(['/backoffice/login'], { queryParams: { mode: 'admin' } });
};

export const backOfficeClientGuard = async () => {
  const auth = inject(BackOfficeAuth);
  const router = inject(Router);
  if ((await auth.sessionMode()) === 'client') return true;
  return router.createUrlTree(['/backoffice/login'], { queryParams: { mode: 'client' } });
};
