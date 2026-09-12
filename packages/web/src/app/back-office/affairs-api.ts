import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Affair,
  AffairCreateRequest,
  AffairFailure,
  AffairList,
  AffairQuoteLinkRequest,
  AffairUpdateRequest,
  AuditEvent,
} from '@froment/contracts';
import { requestOutcome } from '@shared/api-outcome';
import { Schema } from 'effect';

@Injectable({ providedIn: 'root' })
export class AffairsApi {
  private readonly http = inject(HttpClient);

  list() {
    return requestOutcome(this.http.get('/api/affairs'), AffairList, AffairFailure, 'affair.error');
  }

  get(id: string) {
    return requestOutcome(
      this.http.get(`/api/affairs/${id}`),
      Affair,
      AffairFailure,
      'affair.error',
    );
  }

  create(request: typeof AffairCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/affairs', request),
      Affair,
      AffairFailure,
      'affair.error',
    );
  }

  update(id: string, request: typeof AffairUpdateRequest.Type) {
    return requestOutcome(
      this.http.put(`/api/affairs/${id}`, request),
      Affair,
      AffairFailure,
      'affair.error',
    );
  }

  linkQuote(id: string, request: typeof AffairQuoteLinkRequest.Type) {
    return requestOutcome(
      this.http.post(`/api/affairs/${id}/quotes`, request),
      Affair,
      AffairFailure,
      'affair.error',
    );
  }

  events(id: string) {
    return requestOutcome(
      this.http.get(`/api/affairs/${id}/events`),
      Schema.Array(AuditEvent),
      AffairFailure,
      'affair.error',
    );
  }
}
