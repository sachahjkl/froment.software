import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ReceiptCancel } from './receipt-cancel';
import {
  creditFixture,
  field,
  inputValue,
  invoiceFixture,
  invoiceId,
  paymentFixture,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('ReceiptCancel', () => {
  afterEach(() => vi.restoreAllMocks());
  it('cancels an incorrect entry with a reason, never a bank refund', async () => {
    const payment = paymentFixture();
    const { root, fixture, api, credits } = await setupInvoicePage(ReceiptCancel, {
      invoice: { ...invoiceFixture(), payments: [payment] },
      params: { invoiceId, paymentId: payment.id },
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.cancelPayment).not.toHaveBeenCalled();
    inputValue(field(root, 'textarea'), 'Wrong amount');
    api.cancelPayment.mockResolvedValue({ success: true, result: invoiceFixture() });
    submitForm(root);
    await fixture.whenStable();
    expect(api.cancelPayment).toHaveBeenCalledWith(invoiceId, payment.id, {
      expectedVersion: 2,
      reason: 'Wrong amount',
    });
    expect(credits.refund).not.toHaveBeenCalled();
  });
  it('blocks cancellation when active refunds depend on the receipt', async () => {
    const payment = paymentFixture();
    const credit = creditFixture();
    const { root } = await setupInvoicePage(ReceiptCancel, {
      invoice: { ...invoiceFixture(), payments: [payment] },
      params: { invoiceId, paymentId: payment.id },
      credits: {
        ...credit,
        refunds: [
          {
            id: '01ARZ3NDEKTSV4RRFFQ69G5FB7',
            invoiceId,
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
      },
    });
    expect(root.querySelector('form')).toBeNull();
  });
});
