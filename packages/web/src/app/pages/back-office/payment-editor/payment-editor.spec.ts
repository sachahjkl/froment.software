import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { PaymentEditor } from './payment-editor';
import {
  field,
  inputValue,
  invoiceFixture,
  invoiceId,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('PaymentEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('validates a positive bounded receipt and focuses its amount', async () => {
    const { root, fixture, api } = await setupInvoicePage(PaymentEditor);
    inputValue(field(root, 'input[inputmode="decimal"]'), '12.01');
    submitForm(root);
    await fixture.whenStable();
    expect(api.recordPayment).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field(root, 'input[inputmode="decimal"]'));
    expect(root.querySelector('#payment-amount-error')?.textContent).toMatch(/positif|positive/);
  });
  it('retries the exact request after a lost response and freezes its fields', async () => {
    const { root, fixture, api } = await setupInvoicePage(PaymentEditor);
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    inputValue(field(root, 'input[inputmode="decimal"]'), '4.00');
    inputValue(field(root, 'input[type="date"]'), '2026-08-20');
    inputValue(field(root, 'input[aria-describedby="payment-reference-error"]'), 'BANK-456');
    api.recordPayment.mockRejectedValueOnce(new Error('offline'));
    submitForm(root);
    await fixture.whenStable();
    const request = api.recordPayment.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      amountCents: 400,
      expectedVersion: 2,
      paidOn: '2026-08-20',
      method: 'transfer',
      reference: 'BANK-456',
    });
    expect(field(root, 'input[inputmode="decimal"]').disabled).toBe(true);
    api.recordPayment.mockResolvedValue({ success: true, result: invoiceFixture() });
    await fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(api.recordPayment).toHaveBeenLastCalledWith(invoiceId, request);
    expect(fixture.componentInstance['task'].completed()).toBe(true);
    expect(root.textContent).toMatch(/ne constitue jamais|never a receipt/);
  });
  it('rejects navigation while saving and accepts it only after completion', async () => {
    const { fixture } = await setupInvoicePage(PaymentEditor);
    fixture.componentInstance['task'].busy.set(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fixture.componentInstance['task'].busy.set(false);
    fixture.componentInstance['task'].completed.set(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
  it('does not offer a receipt for a credited invoice', async () => {
    const { root } = await setupInvoicePage(PaymentEditor, {
      invoice: { ...invoiceFixture(), creditedCents: 1200 },
    });
    expect(root.querySelector('form')).toBeNull();
  });
});
