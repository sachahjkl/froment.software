import { DOCUMENT } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { BrowserSession, type BrowserSessionValue, type LoginModeValue } from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { AuthCookieLock } from './auth-cookie-lock';

@Injectable({ providedIn: 'root' })
export class BrowserSessionStore {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly cookieLock = inject(AuthCookieLock);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<BrowserSessionValue | undefined>(undefined);
  private refreshRequest: Promise<LoginModeValue | undefined> | undefined;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;

  constructor() {
    const window = this.document.defaultView;
    const refreshOnResume = () => {
      if (this.document.visibilityState !== 'hidden') this.refreshExpiringSession();
    };
    this.document.addEventListener('visibilitychange', refreshOnResume);
    window?.addEventListener('focus', refreshOnResume);
    this.destroyRef.onDestroy(() => {
      if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
      this.document.removeEventListener('visibilitychange', refreshOnResume);
      window?.removeEventListener('focus', refreshOnResume);
    });
  }

  private current(): BrowserSessionValue | undefined {
    const session = this.state();
    if (session !== undefined && session.expiresAt <= Date.now()) {
      this.clear();
      return undefined;
    }
    return session;
  }

  mode(): LoginModeValue | undefined {
    return this.current()?.mode;
  }

  set(session: BrowserSessionValue): BrowserSessionValue {
    this.generation += 1;
    this.state.set(session);
    this.scheduleRefresh(session.expiresAt);
    return session;
  }

  clear(): void {
    this.generation += 1;
    this.state.set(undefined);
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
    this.refreshTimer = undefined;
  }

  refresh(): Promise<LoginModeValue | undefined> {
    if (this.refreshRequest !== undefined) return this.refreshRequest;
    const generation = this.generation;
    this.refreshRequest = this.cookieLock
      .run(async () => {
        try {
          const response = await firstValueFrom(
            this.http.post<unknown>('/api/auth/refresh', undefined),
          );
          const session = Schema.decodeUnknownSync(BrowserSession)(response);
          if (this.generation !== generation) return this.mode();
          return this.set(session).mode;
        } catch {
          if (this.generation === generation) this.clear();
          return this.mode();
        }
      })
      .finally(() => {
        this.refreshRequest = undefined;
      });
    return this.refreshRequest;
  }

  private scheduleRefresh(expiresAt: number): void {
    if (this.refreshTimer !== undefined) clearTimeout(this.refreshTimer);
    if (expiresAt <= Date.now()) {
      this.refreshTimer = undefined;
      return;
    }
    const delay = Math.max(0, expiresAt - Date.now() - 30_000);
    this.refreshTimer = setTimeout(() => void this.refresh(), Math.min(delay, 2_147_483_647));
  }

  private refreshExpiringSession(): void {
    const session = this.state();
    if (session !== undefined && session.expiresAt <= Date.now() + 30_000) void this.refresh();
  }
}
