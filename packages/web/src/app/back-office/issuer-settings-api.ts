import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IssuerSettingsDetail,
  IssuerSettingsConflict,
  RequestRateLimited,
  type IssuerSettingsUpdateRequestValue,
  type IssuerSettingsDetailValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

const issuerSettingsFailure = Schema.Union([IssuerSettingsConflict, RequestRateLimited]);

export type IssuerSettingsOutcome = ApiOutcome<
  IssuerSettingsDetailValue,
  typeof issuerSettingsFailure.Type,
  'issuer.error'
>;

@Injectable({ providedIn: 'root' })
export class IssuerSettingsApi {
  private readonly http = inject(HttpClient);

  async get(): Promise<IssuerSettingsDetailValue> {
    return Schema.decodeUnknownSync(IssuerSettingsDetail)(
      await firstValueFrom(this.http.get<unknown>('/api/issuer-settings')),
    );
  }

  async update(request: IssuerSettingsUpdateRequestValue): Promise<IssuerSettingsOutcome> {
    return requestOutcome(
      this.http.put<unknown>('/api/issuer-settings', request),
      IssuerSettingsDetail,
      issuerSettingsFailure,
      'issuer.error',
    );
  }
}
