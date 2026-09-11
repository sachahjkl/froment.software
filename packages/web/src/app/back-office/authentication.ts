import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  readonly identity: number;
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
    identity: this.sessions.identity(),
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
        readonly identity: number;
        readonly promise: Promise<CurrentAccountValue | undefined>;
      }
    | undefined;
  private settledAccountKey: AccountKey | undefined;
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
        if (this.sessions.mode() !== undefined && this.settledAccountKey !== this.accountKey())
          void this.currentAccount();
      });
    });
  }

  can(permission: PermissionCodeValue): boolean {
    return this.account()?.permissions.includes(permission) === true;
  }

  refreshAccount(): Promise<CurrentAccountValue | undefined> {
    if (this.accountRequest?.identity === this.sessions.identity())
      return this.accountRequest.promise;
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
    if (!this.sessions.refreshing() && this.sessions.mode() === undefined)
      return Promise.resolve(undefined);
    const identity = this.sessions.identity();
    const account = this.account();
    if (account !== undefined) return Promise.resolve(account);
    if (this.accountRequest?.identity === identity) return this.accountRequest.promise;
    const promise = this.loadAccount(identity);
    this.accountRequest = { identity, promise };
    return promise;
  }

  private async loadAccount(identity: number): Promise<CurrentAccountValue | undefined> {
    const cached = this.accountCache();
    const expectedUserId = cached?.key.identity === identity ? cached.value.userId : undefined;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (this.sessions.refreshing()) await this.sessions.refresh();
        if (this.sessions.identity() !== identity || this.sessions.mode() === undefined)
          return undefined;
        const key = this.accountKey();
        let response: unknown;
        try {
          response = await firstValueFrom(this.http.get<unknown>('/api/auth/account'));
        } catch (error) {
          if (
            attempt !== 0 ||
            !(error instanceof HttpErrorResponse) ||
            error.status !== 401 ||
            this.sessions.identity() !== identity
          )
            return undefined;
          if (this.sessions.revision() === key.session || this.sessions.refreshing())
            await this.sessions.refresh();
          continue;
        }
        if (this.sessions.identity() !== identity) return undefined;
        if (this.accountKey() !== key || this.sessions.refreshing()) continue;
        const value = Schema.decodeUnknownSync(CurrentAccount)(response);
        if (
          value.mode !== this.sessions.mode() ||
          (expectedUserId !== undefined && value.userId !== expectedUserId)
        ) {
          this.sessions.clear();
          return undefined;
        }
        this.accountCache.set({ key, value });
        return value;
      }
      return undefined;
    } catch {
      return undefined;
    } finally {
      if (this.sessions.identity() === identity) this.settledAccountKey = this.accountKey();
      if (this.accountRequest?.identity === identity) this.accountRequest = undefined;
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
