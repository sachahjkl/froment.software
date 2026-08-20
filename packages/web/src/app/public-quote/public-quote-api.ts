import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  PublicQuoteConsultation,
  QuoteAcceptanceResult,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  RequestRateLimited,
  type PublicQuoteConsultationValue,
  type PublicQuoteSignatureRequestValue,
  type QuoteAcceptanceResultValue,
  type QuoteLinkTokenValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '../shared/api-outcome';

const PublicQuoteFailure = Schema.Union([
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  RequestRateLimited,
]);
type PublicQuoteFailure = typeof PublicQuoteFailure.Type;
export type PublicQuoteOutcome<T> = ApiOutcome<T, PublicQuoteFailure, 'publicQuote.error'>;

@Injectable({ providedIn: 'root' })
export class PublicQuoteApi {
  private readonly http = inject(HttpClient);

  async get(token: QuoteLinkTokenValue): Promise<PublicQuoteOutcome<PublicQuoteConsultationValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/public/quote-link', { token }),
      PublicQuoteConsultation,
      PublicQuoteFailure,
      'publicQuote.error',
    );
  }

  async getPdf(token: QuoteLinkTokenValue): Promise<Blob> {
    return firstValueFrom(
      this.http.post('/api/public/quote-link/pdf', { token }, { responseType: 'blob' }),
    );
  }

  async sign(
    request: PublicQuoteSignatureRequestValue,
  ): Promise<PublicQuoteOutcome<QuoteAcceptanceResultValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/public/quote-link/signature', request),
      QuoteAcceptanceResult,
      PublicQuoteFailure,
      'publicQuote.error',
    );
  }
}
