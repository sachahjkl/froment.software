import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IntegrationToken,
  IntegrationTokenCreated,
  IntegrationTokenFailure,
  IntegrationTokenPage,
  type IntegrationTokenCreateRequestValue,
  type IntegrationTokenCreatedValue,
  type IntegrationTokenFailureValue,
  type IntegrationTokenPageValue,
  type IntegrationTokenValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type IntegrationTokenCreateOutcome = ApiOutcome<
  IntegrationTokenCreatedValue,
  IntegrationTokenFailureValue,
  'integration_token.error'
>;
export type IntegrationTokenRevokeOutcome = ApiOutcome<
  IntegrationTokenValue,
  IntegrationTokenFailureValue,
  'integration_token.error'
>;

@Injectable({ providedIn: 'root' })
export class IntegrationTokensApi {
  private readonly http = inject(HttpClient);

  async list(cursor?: UlidValue): Promise<IntegrationTokenPageValue> {
    const params = cursor === undefined ? undefined : new HttpParams().set('cursor', cursor);
    return Schema.decodeUnknownSync(IntegrationTokenPage)(
      await firstValueFrom(this.http.get<unknown>('/api/integration-tokens', { params })),
    );
  }

  async create(
    request: IntegrationTokenCreateRequestValue,
  ): Promise<IntegrationTokenCreateOutcome> {
    return requestOutcome(
      this.http.post<unknown>('/api/integration-tokens', request),
      IntegrationTokenCreated,
      IntegrationTokenFailure,
      'integration_token.error',
    );
  }

  async revoke(tokenId: UlidValue): Promise<IntegrationTokenRevokeOutcome> {
    return requestOutcome(
      this.http.post<unknown>(`/api/integration-tokens/${tokenId}/revoke`, {}),
      IntegrationToken,
      IntegrationTokenFailure,
      'integration_token.error',
    );
  }
}
