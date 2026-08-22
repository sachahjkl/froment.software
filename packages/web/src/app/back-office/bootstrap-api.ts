import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BootstrapFailure,
  BootstrapResult,
  BootstrapStatus,
  type BootstrapFailureCode,
  type BootstrapFailureValue,
  type BootstrapResultValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';
import { BrowserSessionStore } from './browser-session-store';
import { AuthCookieLock } from './auth-cookie-lock';

export type BootstrapErrorCode = BootstrapFailureCode | 'bootstrap.error';

export type BootstrapOutcome = ApiOutcome<
  BootstrapResultValue,
  BootstrapFailureValue,
  'bootstrap.error'
>;

@Injectable({ providedIn: 'root' })
export class BootstrapApi {
  private readonly http = inject(HttpClient);
  private readonly sessions = inject(BrowserSessionStore);
  private readonly cookieLock = inject(AuthCookieLock);

  async status(): Promise<boolean> {
    const status = Schema.decodeUnknownSync(BootstrapStatus)(
      await firstValueFrom(this.http.get<unknown>('/api/bootstrap')),
    );
    return status.available;
  }

  async create(request: {
    readonly bootstrapPassword: string;
    readonly email: string;
    readonly password: string;
  }): Promise<BootstrapOutcome> {
    return this.cookieLock.run(async () => {
      const outcome = await requestOutcome(
        this.http.post<unknown>('/api/bootstrap', request),
        BootstrapResult,
        BootstrapFailure,
        'bootstrap.error',
      );
      if (outcome.success) this.sessions.set(outcome.result);
      return outcome;
    });
  }
}
