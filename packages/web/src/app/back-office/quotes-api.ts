import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  QuoteDetail,
  DocumentArtifact,
  QuoteFailure,
  QuoteList,
  QuoteSendResult,
  type QuoteCreateRequestValue,
  type DocumentArtifactValue,
  type QuoteDetailValue,
  type QuoteFailureValue,
  type QuoteListValue,
  type QuoteRevisionCreateRequestValue,
  type QuoteSendRequestValue,
  type QuoteSendResultValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type QuoteErrorCode = QuoteFailureValue['code'] | 'quote.error';
export type QuoteOutcome<T> = ApiOutcome<T, QuoteFailureValue, 'quote.error'>;

@Injectable({ providedIn: 'root' })
export class QuotesApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<QuoteListValue> {
    return Schema.decodeUnknownSync(QuoteList)(
      await firstValueFrom(this.http.get<unknown>('/api/quotes')),
    );
  }

  async get(quoteId: UlidValue): Promise<QuoteOutcome<QuoteDetailValue>> {
    return requestOutcome(
      this.http.get<unknown>(`/api/quotes/${quoteId}`),
      QuoteDetail,
      QuoteFailure,
      'quote.error',
    );
  }

  async create(request: QuoteCreateRequestValue): Promise<QuoteOutcome<QuoteDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/quotes', request),
      QuoteDetail,
      QuoteFailure,
      'quote.error',
    );
  }

  async createRevision(
    quoteId: UlidValue,
    request: QuoteRevisionCreateRequestValue,
  ): Promise<QuoteOutcome<QuoteDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/quotes/${quoteId}/revisions`, request),
      QuoteDetail,
      QuoteFailure,
      'quote.error',
    );
  }

  async renderPdf(
    quoteId: UlidValue,
    version: number,
  ): Promise<QuoteOutcome<DocumentArtifactValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/quotes/${quoteId}/revisions/${version}/pdf`, undefined),
      DocumentArtifact,
      QuoteFailure,
      'quote.error',
    );
  }

  async send(
    quoteId: UlidValue,
    request: QuoteSendRequestValue,
  ): Promise<QuoteOutcome<QuoteSendResultValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/quotes/${quoteId}/send`, request),
      QuoteSendResult,
      QuoteFailure,
      'quote.error',
    );
  }
}
