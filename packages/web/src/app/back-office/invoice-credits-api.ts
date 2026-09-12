import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreditNote,
  CreditNoteDraftRequest,
  CreditNoteDraftUpdate,
  CreditNoteIssueRequest,
  InvoiceCreditFailure,
  InvoiceCredits,
  InvoiceRefundRequest,
} from '@froment/contracts';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class InvoiceCreditsApi {
  private readonly http = inject(HttpClient);
  get(id: string) {
    return requestOutcome(
      this.http.get(`/api/invoices/${id}/credits`),
      InvoiceCredits,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  getNote(id: string) {
    return requestOutcome(
      this.http.get(`/api/credit-notes/${id}`),
      CreditNote,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  create(request: typeof CreditNoteDraftRequest.Type) {
    return requestOutcome(
      this.http.post('/api/credit-notes', request),
      CreditNote,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  update(id: string, request: typeof CreditNoteDraftUpdate.Type) {
    return requestOutcome(
      this.http.put(`/api/credit-notes/${id}`, request),
      CreditNote,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  issue(id: string, request: typeof CreditNoteIssueRequest.Type) {
    return requestOutcome(
      this.http.post(`/api/credit-notes/${id}/issue`, request),
      CreditNote,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  refund(id: string, request: typeof InvoiceRefundRequest.Type) {
    return requestOutcome(
      this.http.post(`/api/invoices/${id}/refunds`, request),
      InvoiceCredits,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
  cancel(id: string, refundId: string, reason: string) {
    return requestOutcome(
      this.http.post(`/api/invoices/${id}/refunds/${refundId}/cancel`, { reason }),
      InvoiceCredits,
      InvoiceCreditFailure,
      'credit.error',
    );
  }
}
