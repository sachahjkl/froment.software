import { invoiceFixture, paymentFixture } from '../billing/billing.spec-helper';
import { invoiceActions, recordedEntryStatus } from './invoice-actions';

describe('Invoice actions', () => {
  it('offers no mutation before the invoice loads', () => {
    expect(invoiceActions(undefined)).toEqual({
      edit: false,
      recordPayment: false,
      credit: false,
      void: false,
    });
  });

  it('edits drafts without offering issued-document actions', () => {
    expect(invoiceActions(invoiceFixture('draft'))).toEqual({
      edit: true,
      recordPayment: false,
      credit: false,
      void: false,
    });
  });

  it('offers receipts, credit and void for an issued invoice without payments', () => {
    expect(invoiceActions(invoiceFixture())).toEqual({
      edit: false,
      recordPayment: true,
      credit: true,
      void: true,
    });
  });

  it('forbids voiding after a payment, including a cancelled payment', () => {
    const invoice = invoiceFixture();
    expect(invoiceActions({ ...invoice, payments: [paymentFixture()] }).void).toBe(false);
    const cancelled = { ...paymentFixture(), cancelledAt: '2026-08-22T06:00:00.000Z' };
    expect(invoiceActions({ ...invoice, payments: [cancelled] }).void).toBe(false);
  });

  it('keeps credit available after payment but never records another receipt', () => {
    expect(invoiceActions(invoiceFixture('paid'))).toEqual({
      edit: false,
      recordPayment: false,
      credit: true,
      void: false,
    });
    expect(
      invoiceActions({
        ...invoiceFixture(),
        payments: [{ ...paymentFixture(), amountCents: 1200 }],
      }).recordPayment,
    ).toBe(false);
  });

  it('forbids credit for a zero total, an existing credit or a void invoice', () => {
    const invoice = invoiceFixture();
    expect(
      invoiceActions({ ...invoice, currentRevision: { ...invoice.currentRevision, totalCents: 0 } })
        .credit,
    ).toBe(false);
    expect(invoiceActions({ ...invoice, creditedCents: 1200 })).toEqual({
      edit: false,
      recordPayment: false,
      credit: false,
      void: false,
    });
    expect(invoiceActions(invoiceFixture('void'))).toEqual({
      edit: false,
      recordPayment: false,
      credit: false,
      void: false,
    });
  });

  it('uses recorded cancellation state for receipts and refunds', () => {
    expect(recordedEntryStatus(null)).toBe('billingWorkspace.active');
    expect(recordedEntryStatus('2026-08-22T06:00:00.000Z')).toBe('billingWorkspace.cancelled');
  });
});
