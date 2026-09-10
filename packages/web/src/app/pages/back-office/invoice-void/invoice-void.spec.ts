import { InvoiceVoid } from './invoice-void';
import { invoiceFixture, paymentFixture, setupInvoicePage } from '../billing/billing.spec-helper';

describe('InvoiceVoid', () => {
  it('refuses invoices with a receipt even when that receipt was cancelled', async () => {
    const payment = {
      ...paymentFixture(),
      cancelledAt: '2026-08-21T06:00:00.000Z',
      cancellationReason: 'Incorrect entry',
    };
    const { root } = await setupInvoicePage(InvoiceVoid, {
      invoice: { ...invoiceFixture(), payments: [payment] },
    });
    expect(root.querySelector('form')).toBeNull();
  });
  it('refuses credited invoices', async () => {
    const { root } = await setupInvoicePage(InvoiceVoid, {
      invoice: { ...invoiceFixture(), creditedCents: 1200 },
    });
    expect(root.querySelector('form')).toBeNull();
  });
});
