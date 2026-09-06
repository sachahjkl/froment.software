import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import {
  AuthenticationFailure,
  BrowserSession,
  CurrentAccount,
  type CurrentAccountValue,
  type AuthenticationFailureValue,
  type LoginModeValue,
  LoginRequest,
  PasswordChangeFailure,
  AccountSessionList,
  AccountSessionFailure,
  type PasswordChangeRequestValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { decodeApiFailure, requestOutcome, type ApiFailure } from '@shared/api-outcome';
import { BrowserSessionStore } from './browser-session-store';
import { AuthCookieLock } from './auth-cookie-lock';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';

export type AuthenticationOutcome =
  | { readonly success: true; readonly mode: LoginModeValue }
  | ApiFailure<AuthenticationFailureValue, 'authentication.error'>;

@Injectable({ providedIn: 'root' })
export class Authentication {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sessions = inject(BrowserSessionStore);
  private readonly cookieLock = inject(AuthCookieLock);

  async authenticatePasskey(assertion: () => Promise<AuthenticationResponseJSON>) {
    try {
      return await this.cookieLock.run(async () => {
        const responseBody = await assertion();
        const response = await firstValueFrom(
          this.http.post('/api/auth/passkeys/login/verify', responseBody),
        );
        const session = Schema.decodeUnknownSync(BrowserSession)(response);
        this.sessions.set(session);
        return { success: true as const, mode: session.mode };
      });
    } catch (cause) {
      return decodeApiFailure({ cause }, AuthenticationFailure, 'passkey.error');
    }
  }

  async sessionMode(): Promise<LoginModeValue | undefined> {
    if (!this.isBrowser) return undefined;
    try {
      return this.sessions.mode() ?? (await this.sessions.refresh());
    } catch {
      return undefined;
    }
  }

  async currentAccount(): Promise<CurrentAccountValue | undefined> {
    if (!this.isBrowser) return undefined;
    try {
      const response = await firstValueFrom(this.http.get<unknown>('/api/auth/account'));
      return Schema.decodeUnknownSync(CurrentAccount)(response);
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
      return await this.cookieLock.run(async () => {
        const response = await firstValueFrom(this.http.post<unknown>('/api/auth/login', request));
        const session = Schema.decodeUnknownSync(BrowserSession)(response);
        this.sessions.set(session);
        return { success: true, mode: session.mode };
      });
    } catch (error) {
      return decodeApiFailure({ cause: error }, AuthenticationFailure, 'authentication.error');
    }
  }

  async signOut(): Promise<boolean> {
    if (!this.isBrowser) return false;
    return this.cookieLock.run(async () => {
      this.sessions.clear();
      try {
        await firstValueFrom(this.http.post<void>('/api/auth/logout', undefined));
        return true;
      } catch {
        return false;
      }
    });
  }

  async changePassword(request: PasswordChangeRequestValue) {
    try {
      return await this.cookieLock.run(async () => {
        await firstValueFrom(this.http.post<void>('/api/auth/password', request));
        this.sessions.clear();
        return { success: true as const };
      });
    } catch (cause) {
      return decodeApiFailure({ cause }, PasswordChangeFailure, 'authentication.error');
    }
  }

  async listSessions() {
    return requestOutcome(
      this.http.get('/api/auth/sessions'),
      AccountSessionList,
      AccountSessionFailure,
      'authentication.error',
    );
  }

  async revokeSession(sessionId: string) {
    try {
      await firstValueFrom(
        this.http.post<void>(`/api/auth/sessions/${sessionId}/revoke`, undefined),
      );
      return { success: true as const };
    } catch (cause) {
      return decodeApiFailure({ cause }, AccountSessionFailure, 'authentication.error');
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
