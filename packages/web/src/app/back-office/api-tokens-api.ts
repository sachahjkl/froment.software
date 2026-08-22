import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ApiToken,
  ApiTokenCreated,
  ApiTokenFailure,
  ApiTokenPage,
  type ApiTokenCreateRequestValue,
  type ApiTokenCreatedValue,
  type ApiTokenFailureValue,
  type ApiTokenPageValue,
  type ApiTokenValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type ApiTokenCreateOutcome = ApiOutcome<
  ApiTokenCreatedValue,
  ApiTokenFailureValue,
  'api_token.error'
>;
export type ApiTokenRevokeOutcome = ApiOutcome<
  ApiTokenValue,
  ApiTokenFailureValue,
  'api_token.error'
>;

@Injectable({ providedIn: 'root' })
export class ApiTokensApi {
  private readonly http = inject(HttpClient);

  async list(cursor?: UlidValue): Promise<ApiTokenPageValue> {
    const params = cursor === undefined ? undefined : new HttpParams().set('cursor', cursor);
    return Schema.decodeUnknownSync(ApiTokenPage)(
      await firstValueFrom(this.http.get<unknown>('/api/tokens', { params })),
    );
  }

  async create(request: ApiTokenCreateRequestValue): Promise<ApiTokenCreateOutcome> {
    return requestOutcome(
      this.http.post<unknown>('/api/tokens', request),
      ApiTokenCreated,
      ApiTokenFailure,
      'api_token.error',
    );
  }

  async revoke(tokenId: UlidValue): Promise<ApiTokenRevokeOutcome> {
    return requestOutcome(
      this.http.post<unknown>(`/api/tokens/${tokenId}/revoke`, {}),
      ApiToken,
      ApiTokenFailure,
      'api_token.error',
    );
  }
}
