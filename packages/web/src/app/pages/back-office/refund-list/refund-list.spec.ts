import { TestBed } from '@angular/core/testing';
import { provideAccount } from '@backoffice/account.spec-helper';
import { provideRouter } from '@angular/router';
import { InvoicesApi } from '@backoffice/invoices-api';
import { RefundList } from './refund-list';
import { invoiceFixture } from '../billing/billing.spec-helper';

describe('RefundList', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('links recorded refunds to their invoice context without a bank transfer form', async () => {
    const invoice = invoiceFixture();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InvoicesApi,
          useValue: {
            refunds: async () => ({
              success: true,
              result: [
                {
                  id: '01ARZ3NDEKTSV4RRFFQ69G5FB7',
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  title: 'Audit',
                  clientId: invoice.clientId,
                  clientDisplayName: 'Acme',
                  orderId: invoice.orderId,
                  orderReference: invoice.orderReference,
                  requestId: crypto.randomUUID(),
                  amountCents: 200,
                  refundedOn: '2026-08-22',
                  reference: 'REFUND',
                  recordedAt: '2026-08-22T06:00:00.000Z',
                  recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
                  cancelledAt: null,
                  cancelledByUserId: null,
                  cancellationReason: null,
                },
              ],
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(RefundList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('tbody a')?.textContent).toBe('REFUND');
    expect(root.querySelector('tbody a')?.getAttribute('href')).toContain('tab=credit');
    expect(root.querySelector('input[inputmode="decimal"]')).toBeNull();
  });
});
