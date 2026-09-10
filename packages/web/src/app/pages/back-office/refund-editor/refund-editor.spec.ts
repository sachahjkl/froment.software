import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { RefundEditor } from './refund-editor';
import {
  creditFixture,
  field,
  inputValue,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('RefundEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('bounds refunds to the active receipt balance, not the full credit amount', async () => {
    const { root, fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    inputValue(field(root, 'input[inputmode="decimal"]'), '4.01');
    submitForm(root);
    await fixture.whenStable();
    expect(credits.refund).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field(root, 'input[inputmode="decimal"]'));
    expect(root.textContent).toMatch(/aucun virement|does not initiate a bank transfer/);
  });
  it('retries a refund without changing its identifier or amount', async () => {
    const { root, fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    inputValue(field(root, 'input[inputmode="decimal"]'), '2.00');
    inputValue(field(root, 'input[type="date"]'), '2026-08-22');
    inputValue(field(root, 'input[aria-describedby="refund-reference-error"]'), 'REFUND-1');
    credits.refund.mockRejectedValueOnce(new Error('offline'));
    submitForm(root);
    await fixture.whenStable();
    const request = credits.refund.mock.calls[0]?.[1];
    expect(request).toMatchObject({
      amountCents: 200,
      refundedOn: '2026-08-22',
      reference: 'REFUND-1',
    });
    credits.refund.mockResolvedValue({ success: true, result: creditFixture() });
    await fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(credits.refund.mock.calls[1]?.[1]).toEqual(request);
  });
  it('does not offer refunds without a credit note', async () => {
    const { root } = await setupInvoicePage(RefundEditor);
    expect(root.querySelector('form')).toBeNull();
  });
});
