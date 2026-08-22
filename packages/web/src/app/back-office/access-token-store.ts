import { HttpBackend, HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { AccessToken, type AccessTokenValue, type LoginModeValue } from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AccessTokenStore {
  private readonly http = new HttpClient(inject(HttpBackend));
  private readonly state = signal<AccessTokenValue | undefined>(undefined);
  private refreshRequest: Promise<LoginModeValue | undefined> | undefined;

  token(): string | undefined {
    return this.state()?.accessToken;
  }

  mode(): LoginModeValue | undefined {
    return this.state()?.mode;
  }

  set(token: AccessTokenValue): AccessTokenValue {
    this.state.set(token);
    return token;
  }

  clear(): void {
    this.state.set(undefined);
  }

  refresh(): Promise<LoginModeValue | undefined> {
    if (this.refreshRequest !== undefined) return this.refreshRequest;
    this.refreshRequest = firstValueFrom(this.http.post<unknown>('/api/auth/refresh', undefined))
      .then((response) => this.set(Schema.decodeUnknownSync(AccessToken)(response)).mode)
      .catch(() => {
        this.clear();
        return undefined;
      })
      .finally(() => {
        this.refreshRequest = undefined;
      });
    return this.refreshRequest;
  }
}
