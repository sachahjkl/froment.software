import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InvoiceCreditsApi } from './invoice-credits-api';

describe('InvoiceCreditsApi', () => {
  it.each([
    ['InvoiceCreditRequestConflict', 'invoice.credit_request_conflict', 409],
    ['RequestInvalidOrigin', 'request.invalid_origin', 403],
    ['RequestTooLarge', 'request.too_large', 413],
    ['UnknownFailure', 'credit.error', 500],
  ] as const)(
    'decodes %s without treating an unknown response as a business refusal',
    async (_tag, code, status) => {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      const http = TestBed.inject(HttpTestingController);
      const request = {
        requestId: crypto.randomUUID(),
        amountCents: 200,
        refundedOn: '2026-09-01',
        reference: 'R-1',
      };
      const outcome = TestBed.inject(InvoiceCreditsApi).refund('invoice-id', request);
      const pending = http.expectOne('/api/invoices/invoice-id/refunds');
      expect(pending.request.body).toEqual(request);
      pending.flush({ _tag, code }, { status, statusText: 'Request rejected' });
      await expect(outcome).resolves.toMatchObject({ success: false, code });
      http.verify();
    },
  );
});
