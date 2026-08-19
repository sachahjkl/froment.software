import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IssuerSettings,
  QuoteFailure,
  type IssuerSettingsUpdateRequestValue,
  type IssuerSettingsValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

export type IssuerSettingsOutcome =
  | { readonly success: true; readonly result: IssuerSettingsValue }
  | { readonly success: false; readonly code: string };

@Injectable({ providedIn: 'root' })
export class BackOfficeIssuerSettingsApi {
  private readonly http = inject(HttpClient);

  async get(): Promise<IssuerSettingsValue> {
    return Schema.decodeUnknownSync(IssuerSettings)(
      await firstValueFrom(this.http.get<unknown>('/api/issuer-settings')),
    );
  }

  async update(request: IssuerSettingsUpdateRequestValue): Promise<IssuerSettingsOutcome> {
    try {
      const response = await firstValueFrom(
        this.http.put<unknown>('/api/issuer-settings', request),
      );
      return { success: true, result: Schema.decodeUnknownSync(IssuerSettings)(response) };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        try {
          return { success: false, code: Schema.decodeUnknownSync(QuoteFailure)(error.error).code };
        } catch {
          return { success: false, code: 'issuer.error' };
        }
      }
      return { success: false, code: 'issuer.error' };
    }
  }
}
