import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IssuerSettings,
  QuoteFailure,
  type IssuerSettingsUpdateRequestValue,
  type IssuerSettingsValue,
  type QuoteFailureValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type IssuerSettingsOutcome = ApiOutcome<
  IssuerSettingsValue,
  QuoteFailureValue,
  'issuer.error'
>;

@Injectable({ providedIn: 'root' })
export class BackOfficeIssuerSettingsApi {
  private readonly http = inject(HttpClient);

  async get(): Promise<IssuerSettingsValue> {
    return Schema.decodeUnknownSync(IssuerSettings)(
      await firstValueFrom(this.http.get<unknown>('/api/issuer-settings')),
    );
  }

  async update(request: IssuerSettingsUpdateRequestValue): Promise<IssuerSettingsOutcome> {
    return requestOutcome(
      this.http.put<unknown>('/api/issuer-settings', request),
      IssuerSettings,
      QuoteFailure,
      'issuer.error',
    );
  }
}
