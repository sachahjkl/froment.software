import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  async isAuthenticated(): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      const response = await firstValueFrom(this.http.get<unknown>('/api/auth/session'));
      return Schema.decodeUnknownSync(SessionStatus)(response).authenticated;
    } catch {
      return false;
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
      if (session.authenticated) return { success: true };
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
      const csrfToken = Schema.decodeUnknownSync(AccessIdentifier)(
        this.readCookie('__Host-froment-csrf'),
      );
      const response = await firstValueFrom(
        this.http.post<unknown>('/api/auth/logout', undefined, {
          headers: new HttpHeaders({ 'x-csrf-token': csrfToken }),
        }),
      );
      return !Schema.decodeUnknownSync(SessionStatus)(response).authenticated;
    } catch {
      return false;
    }
  }

  private readCookie(name: string): string | undefined {
    const prefix = `${name}=`;
    return this.document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(prefix))
      ?.slice(prefix.length);
  }
}

export const backOfficeGuard: CanActivateFn = async () => {
  const auth = inject(BackOfficeAuth);
  const router = inject(Router);
  return (await auth.isAuthenticated()) || router.createUrlTree(['/back-office']);
};
