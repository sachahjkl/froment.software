import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ClientAccess,
  ClientFailure,
  ClientList,
  ClientSummary,
  type ClientAccessValue,
  type ClientCreateRequestValue,
  type ClientFailureCode,
  type ClientFailureValue,
  type ClientListValue,
  type ClientSummaryValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type ClientErrorCode = ClientFailureCode | 'client.error';

export type ClientOutcome<T> = ApiOutcome<T, ClientFailureValue, 'client.error'>;

@Injectable({ providedIn: 'root' })
export class ClientsApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<ClientListValue> {
    const response = await firstValueFrom(this.http.get<unknown>('/api/clients'));
    return Schema.decodeUnknownSync(ClientList)(response);
  }

  async create(request: ClientCreateRequestValue): Promise<ClientOutcome<ClientSummaryValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/clients', request),
      ClientSummary,
      ClientFailure,
      'client.error',
    );
  }

  async archive(clientId: UlidValue): Promise<ClientOutcome<ClientSummaryValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/clients/${clientId}/archive`, undefined),
      ClientSummary,
      ClientFailure,
      'client.error',
    );
  }

  async createAccess(clientId: UlidValue): Promise<ClientOutcome<ClientAccessValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/clients/${clientId}/access`, undefined),
      ClientAccess,
      ClientFailure,
      'client.error',
    );
  }
}
