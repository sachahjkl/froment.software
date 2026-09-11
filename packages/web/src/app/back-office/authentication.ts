import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
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
  type PermissionCodeValue,
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

interface AccountKey {
  readonly session: number;
  readonly refresh: number;
}

@Injectable({ providedIn: 'root' })
export class Authentication {
  private readonly http = inject(HttpClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly sessions = inject(BrowserSessionStore);
  private readonly cookieLock = inject(AuthCookieLock);
  private readonly accountObserved = signal(false);
  private readonly accountRefresh = signal(0);
  private readonly accountKey = computed<AccountKey>(() => ({
    session: this.sessions.revision(),
    refresh: this.accountRefresh(),
  }));
  private readonly accountCache = signal<
    | {
        readonly key: AccountKey;
        readonly value: CurrentAccountValue;
      }
    | undefined
  >(undefined);
  private accountRequest:
    | {
        readonly key: AccountKey;
        readonly promise: Promise<CurrentAccountValue | undefined>;
      }
    | undefined;
  readonly account = computed(() => {
    const cached = this.accountCache();
    return !this.sessions.refreshing() && cached?.key === this.accountKey()
      ? cached.value
      : undefined;
  });

  constructor() {
    effect(() => {
      this.accountKey();
      if (!this.accountObserved() || this.sessions.refreshing()) return;
      untracked(() => {
        if (this.sessions.mode() !== undefined) void this.currentAccount();
      });
    });
  }

  can(permission: PermissionCodeValue): boolean {
    return this.account()?.permissions.includes(permission) === true;
  }

  async refreshAccount(): Promise<CurrentAccountValue | undefined> {
    this.accountRefresh.update((revision) => revision + 1);
    return this.currentAccount();
  }

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

  currentAccount(): Promise<CurrentAccountValue | undefined> {
    if (!this.isBrowser) return Promise.resolve(undefined);
    this.accountObserved.set(true);
    if (this.sessions.refreshing()) {
      return this.sessions
        .refresh()
        .then((mode) => (mode === undefined ? undefined : this.currentAccount()));
    }
    if (this.sessions.mode() === undefined) return Promise.resolve(undefined);
    const key = this.accountKey();
    const account = this.account();
    if (account !== undefined) return Promise.resolve(account);
    if (this.accountRequest?.key === key) return this.accountRequest.promise;
    const promise = this.loadAccount(key);
    this.accountRequest = { key, promise };
    return promise;
  }

  private async loadAccount(key: AccountKey): Promise<CurrentAccountValue | undefined> {
    try {
      const response = await firstValueFrom(this.http.get<unknown>('/api/auth/account'));
      const value = Schema.decodeUnknownSync(CurrentAccount)(response);
      if (this.accountKey() !== key) return undefined;
      this.accountCache.set({ key, value });
      return value;
    } catch {
      return undefined;
    } finally {
      if (this.accountRequest?.key === key) this.accountRequest = undefined;
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
