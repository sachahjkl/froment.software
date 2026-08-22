import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IntegrationToken,
  IntegrationTokenCreated,
  IntegrationTokenFailure,
  IntegrationTokenList,
  type IntegrationTokenCreateRequestValue,
  type IntegrationTokenCreatedValue,
  type IntegrationTokenFailureValue,
  type IntegrationTokenListValue,
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

  async list(): Promise<IntegrationTokenListValue> {
    return Schema.decodeUnknownSync(IntegrationTokenList)(
      await firstValueFrom(this.http.get<unknown>('/api/integration-tokens')),
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
