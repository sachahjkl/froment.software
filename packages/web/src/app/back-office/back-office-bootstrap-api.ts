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

export type BootstrapErrorCode = BootstrapFailureCode | 'bootstrap.error';

export type BootstrapOutcome = ApiOutcome<
  BootstrapResultValue,
  BootstrapFailureValue,
  'bootstrap.error'
>;

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
    return requestOutcome(
      this.http.post<unknown>('/api/bootstrap', { password }),
      BootstrapResult,
      BootstrapFailure,
      'bootstrap.error',
    );
  }
}
