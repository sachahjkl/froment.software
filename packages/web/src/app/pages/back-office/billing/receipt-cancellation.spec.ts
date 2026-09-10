import { type InvoiceCredits, type InvoiceStatusValue } from '@froment/contracts';
import { creditFixture, invoiceFixture, invoiceId, paymentFixture } from './billing.spec-helper';
import { canCancelPayment } from './receipt-cancellation';

function creditsWithRefund(
  amountCents: number,
  cancelledAt: string | null,
): typeof InvoiceCredits.Type {
  return {
    ...creditFixture(),
    refunds: [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FB7',
        invoiceId,
        requestId: '662c2994-179f-45e7-a36c-35127883ccdb',
        amountCents,
        refundedOn: '2026-08-22',
        reference: 'REFUND',
        recordedAt: '2026-08-22T06:00:00.000Z',
        recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        cancelledAt,
        cancelledByUserId: null,
        cancellationReason: null,
      },
    ],
  };
}

describe('Receipt cancellation eligibility', () => {
  it.each<[InvoiceStatusValue, boolean]>([
    ['draft', false],
    ['issued', true],
    ['paid', true],
    ['void', false],
  ])('guards cancellation for a %s invoice', (status, allowed) => {
    const payment = paymentFixture();
    const invoice = { ...invoiceFixture(status), payments: [payment] };
    expect(canCancelPayment(invoice, payment, creditFixture())).toBe(allowed);
    expect(
      canCancelPayment(
        invoice,
        { ...payment, cancelledAt: '2026-08-22T06:00:00.000Z' },
        creditFixture(),
      ),
    ).toBe(false);
  });

  it('blocks cancellation until the invoice, payment and refund state are known', () => {
    const payment = paymentFixture();
    const invoice = { ...invoiceFixture(), payments: [payment] };
    expect(canCancelPayment(invoice, payment, undefined)).toBe(false);
    expect(canCancelPayment(undefined, payment, creditFixture())).toBe(false);
    expect(canCancelPayment(invoice, undefined, creditFixture())).toBe(false);
  });

  it('keeps enough active receipts to cover every active refund', () => {
    const payment = paymentFixture();
    const other = { ...payment, id: '01ARZ3NDEKTSV4RRFFQ69G5FB6', amountCents: 200 };
    const invoice = { ...invoiceFixture(), creditedCents: 1200, payments: [payment, other] };
    expect(canCancelPayment(invoice, payment, creditsWithRefund(200, null))).toBe(true);
    expect(canCancelPayment(invoice, payment, creditsWithRefund(201, null))).toBe(false);
    expect(
      canCancelPayment({ ...invoice, payments: [payment] }, payment, creditsWithRefund(1, null)),
    ).toBe(false);
    const credits = creditsWithRefund(100, null);
    expect(
      canCancelPayment(invoice, payment, {
        ...credits,
        refunds: [...credits.refunds, ...creditsWithRefund(101, null).refunds],
      }),
    ).toBe(false);
  });

  it('excludes cancelled receipts and cancelled refunds from the remaining coverage', () => {
    const payment = paymentFixture();
    const cancelledAt = '2026-08-22T06:00:00.000Z';
    const other = { ...payment, id: '01ARZ3NDEKTSV4RRFFQ69G5FB6', cancelledAt };
    const invoice = { ...invoiceFixture(), creditedCents: 1200, payments: [payment, other] };
    expect(canCancelPayment(invoice, payment, creditsWithRefund(1, null))).toBe(false);
    expect(canCancelPayment(invoice, payment, creditsWithRefund(400, cancelledAt))).toBe(true);
  });

  it('allows an active receipt recorded against an earlier invoice version', () => {
    const payment = paymentFixture();
    const invoice = {
      ...invoiceFixture(),
      version: payment.expectedVersion + 1,
      payments: [payment],
    };
    expect(canCancelPayment(invoice, payment, creditFixture())).toBe(true);
    expect(payment.expectedVersion).toBe(2);
    expect(invoice.version).toBe(3);
  });
});
