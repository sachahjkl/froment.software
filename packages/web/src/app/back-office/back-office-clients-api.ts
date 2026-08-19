import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ClientAccess,
  ClientFailure,
  ClientList,
  ClientSummary,
  type ClientAccessValue,
  type ClientCreateRequestValue,
  type ClientFailureCode,
  type ClientListValue,
  type ClientSummaryValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

export type ClientErrorCode = ClientFailureCode | 'client.error';

export type ClientOutcome<T> =
  | { readonly success: true; readonly result: T }
  | { readonly success: false; readonly code: ClientErrorCode };

@Injectable({ providedIn: 'root' })
export class BackOfficeClientsApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<ClientListValue> {
    const response = await firstValueFrom(this.http.get<unknown>('/api/clients'));
    return Schema.decodeUnknownSync(ClientList)(response);
  }

  async create(request: ClientCreateRequestValue): Promise<ClientOutcome<ClientSummaryValue>> {
    try {
      const response = await firstValueFrom(this.http.post<unknown>('/api/clients', request));
      return { success: true, result: Schema.decodeUnknownSync(ClientSummary)(response) };
    } catch (error) {
      if (error instanceof HttpErrorResponse) return this.failure(error);
      return { success: false, code: 'client.error' };
    }
  }

  async archive(clientId: UlidValue): Promise<ClientOutcome<ClientSummaryValue>> {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(`/api/clients/${clientId}/archive`, undefined),
      );
      return { success: true, result: Schema.decodeUnknownSync(ClientSummary)(response) };
    } catch (error) {
      if (error instanceof HttpErrorResponse) return this.failure(error);
      return { success: false, code: 'client.error' };
    }
  }

  async createAccess(clientId: UlidValue): Promise<ClientOutcome<ClientAccessValue>> {
    try {
      const response = await firstValueFrom(
        this.http.post<unknown>(`/api/clients/${clientId}/access`, undefined),
      );
      return { success: true, result: Schema.decodeUnknownSync(ClientAccess)(response) };
    } catch (error) {
      if (error instanceof HttpErrorResponse) return this.failure(error);
      return { success: false, code: 'client.error' };
    }
  }

  private failure<T>(error: HttpErrorResponse): ClientOutcome<T> {
    try {
      const failure = Schema.decodeUnknownSync(ClientFailure)(error.error);
      return { success: false, code: failure.code };
    } catch {
      return { success: false, code: 'client.error' };
    }
  }
}
