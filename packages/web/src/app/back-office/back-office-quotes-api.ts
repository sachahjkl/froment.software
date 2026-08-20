import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  QuoteDetail,
  DocumentArtifact,
  QuoteFailure,
  QuoteList,
  type QuoteCreateRequestValue,
  type DocumentArtifactValue,
  type QuoteDetailValue,
  type QuoteFailureValue,
  type QuoteListValue,
  type QuoteRevisionCreateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom, type Observable } from 'rxjs';

export type QuoteErrorCode = QuoteFailureValue['code'] | 'quote.error';
export type QuoteOutcome<T> =
  | { readonly success: true; readonly result: T }
  | { readonly success: false; readonly code: QuoteErrorCode };

@Injectable({ providedIn: 'root' })
export class BackOfficeQuotesApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<QuoteListValue> {
    return Schema.decodeUnknownSync(QuoteList)(
      await firstValueFrom(this.http.get<unknown>('/api/quotes')),
    );
  }

  async get(quoteId: UlidValue): Promise<QuoteOutcome<QuoteDetailValue>> {
    return this.request(this.http.get<unknown>(`/api/quotes/${quoteId}`));
  }

  async create(request: QuoteCreateRequestValue): Promise<QuoteOutcome<QuoteDetailValue>> {
    return this.request(this.http.post<unknown>('/api/quotes', request));
  }

  async createRevision(
    quoteId: UlidValue,
    request: QuoteRevisionCreateRequestValue,
  ): Promise<QuoteOutcome<QuoteDetailValue>> {
    return this.request(this.http.post<unknown>(`/api/quotes/${quoteId}/revisions`, request));
  }

  async renderPdf(
    quoteId: UlidValue,
    version: number,
  ): Promise<QuoteOutcome<DocumentArtifactValue>> {
    try {
      return {
        success: true,
        result: Schema.decodeUnknownSync(DocumentArtifact)(
          await firstValueFrom(
            this.http.post<unknown>(`/api/quotes/${quoteId}/revisions/${version}/pdf`, undefined),
          ),
        ),
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        try {
          return {
            success: false,
            code: Schema.decodeUnknownSync(QuoteFailure)(error.error).code,
          };
        } catch {
          return { success: false, code: 'quote.error' };
        }
      }
      return { success: false, code: 'quote.error' };
    }
  }

  private async request(source: Observable<unknown>): Promise<QuoteOutcome<QuoteDetailValue>> {
    try {
      return {
        success: true,
        result: Schema.decodeUnknownSync(QuoteDetail)(await firstValueFrom(source)),
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        try {
          return {
            success: false,
            code: Schema.decodeUnknownSync(QuoteFailure)(error.error).code,
          };
        } catch {
          return { success: false, code: 'quote.error' };
        }
      }
      return { success: false, code: 'quote.error' };
    }
  }
}
