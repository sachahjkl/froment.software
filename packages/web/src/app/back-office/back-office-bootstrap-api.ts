import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  BootstrapFailure,
  BootstrapResult,
  BootstrapStatus,
  type BootstrapFailureCode,
  type BootstrapResultValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

export type BootstrapErrorCode = BootstrapFailureCode | 'bootstrap.error';

export type BootstrapOutcome =
  | { readonly success: true; readonly result: BootstrapResultValue }
  | { readonly success: false; readonly code: BootstrapErrorCode };

@Injectable({ providedIn: 'root' })
export class BackOfficeBootstrapApi {
  private readonly http = inject(HttpClient);

  async status(): Promise<boolean> {
    const status = Schema.decodeUnknownSync(BootstrapStatus)(
      await firstValueFrom(this.http.get<unknown>('/api/bootstrap')),
    );
    return status.available;
  }

  async create(password: string): Promise<BootstrapOutcome> {
    try {
      return {
        success: true,
        result: Schema.decodeUnknownSync(BootstrapResult)(
          await firstValueFrom(this.http.post<unknown>('/api/bootstrap', { password })),
        ),
      };
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        (error.status === 401 || error.status === 409 || error.status === 429)
      ) {
        const failure = Schema.decodeUnknownSync(BootstrapFailure)(error.error);
        return { success: false, code: failure.code };
      }
      return { success: false, code: 'bootstrap.error' };
    }
  }
}
