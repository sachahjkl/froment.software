import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { RefundCancel } from './refund-cancel';
import {
  creditFixture,
  field,
  inputValue,
  invoiceId,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('RefundCancel', () => {
  afterEach(() => vi.restoreAllMocks());
  it('requires a reason and records only a local correction', async () => {
    const refund = {
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
    };
    const state = { ...creditFixture(), refunds: [refund] };
    const { fixture, root, credits } = await setupInvoicePage(RefundCancel, {
      credits: state,
      params: { invoiceId, refundId: refund.id },
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    submitForm(root);
    await fixture.whenStable();
    expect(credits.cancel).not.toHaveBeenCalled();
    inputValue(field(root, 'textarea'), 'Wrong reference');
    credits.cancel.mockResolvedValue({ success: true, result: state });
    submitForm(root);
    await fixture.whenStable();
    expect(credits.cancel).toHaveBeenCalledWith(invoiceId, refund.id, 'Wrong reference');
    expect(credits.refund).not.toHaveBeenCalled();
  });
});
