import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CreditNoteRequest,
  InvoiceCreditConflict,
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
      InvoiceCreditConflict,
      'credit.error',
    );
  }
  issue(id: string, request: typeof CreditNoteRequest.Type) {
    return requestOutcome(
      this.http.post(`/api/invoices/${id}/credits`, request),
      InvoiceCredits,
      InvoiceCreditConflict,
      'credit.error',
    );
  }
  refund(id: string, request: typeof InvoiceRefundRequest.Type) {
    return requestOutcome(
      this.http.post(`/api/invoices/${id}/refunds`, request),
      InvoiceCredits,
      InvoiceCreditConflict,
      'credit.error',
    );
  }
  cancel(id: string, refundId: string, reason: string) {
    return requestOutcome(
      this.http.post(`/api/invoices/${id}/refunds/${refundId}/cancel`, { reason }),
      InvoiceCredits,
      InvoiceCreditConflict,
      'credit.error',
    );
  }
}
