import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { AccessToken, type AccessTokenValue, type LoginModeValue } from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { AuthCookieLock } from './auth-cookie-lock';

@Injectable({ providedIn: 'root' })
export class AccessTokenStore {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly cookieLock = inject(AuthCookieLock);
  private readonly state = signal<AccessTokenValue | undefined>(undefined);
  private refreshRequest: Promise<LoginModeValue | undefined> | undefined;
  private generation = 0;

  private current(): AccessTokenValue | undefined {
    const token = this.state();
    if (token !== undefined && token.expiresAt <= Date.now()) {
      this.clear();
      return undefined;
    }
    return token;
  }

  token(): string | undefined {
    return this.current()?.accessToken;
  }

  mode(): LoginModeValue | undefined {
    return this.current()?.mode;
  }

  set(token: AccessTokenValue): AccessTokenValue {
    this.generation += 1;
    this.state.set(token);
    return token;
  }

  clear(): void {
    this.generation += 1;
    this.state.set(undefined);
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
          const token = Schema.decodeUnknownSync(AccessToken)(response);
          if (this.generation !== generation) return this.mode();
          return this.set(token).mode;
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
}
