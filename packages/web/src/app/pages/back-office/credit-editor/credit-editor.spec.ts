import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { CreditEditor } from './credit-editor';
import {
  creditFixture,
  field,
  inputValue,
  invoiceFixture,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('CreditEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('refuses a zero-value invoice', async () => {
    const invoice = invoiceFixture();
    const revision = {
      ...invoice.currentRevision,
      netTotalCents: 0,
      vatTotalCents: 0,
      totalCents: 0,
      lines: invoice.currentRevision.lines.map((line) => ({
        ...line,
        unitPriceCents: 0,
        netTotalCents: 0,
        vatTotalCents: 0,
        totalCents: 0,
      })),
    };
    const { root } = await setupInvoicePage(CreditEditor, {
      invoice: { ...invoice, currentRevision: revision, revisions: [revision] },
    });
    expect(root.querySelector('form')).toBeNull();
  });
  it('requires a reason and confirms one immutable full credit', async () => {
    const { fixture, root, credits } = await setupInvoicePage(CreditEditor);
    submitForm(root);
    await fixture.whenStable();
    expect(credits.issue).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector('textarea'));
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    inputValue(field(root, 'textarea'), 'Cancelled service');
    submitForm(root);
    await fixture.whenStable();
    expect(credits.issue).not.toHaveBeenCalled();
    confirmation.mockResolvedValue(true);
    credits.issue.mockRejectedValueOnce(new Error('offline'));
    submitForm(root);
    await fixture.whenStable();
    const request = credits.issue.mock.calls[0]?.[1];
    expect(request).toMatchObject({ expectedVersion: 2, reason: 'Cancelled service' });
    credits.issue.mockResolvedValue({ success: true, result: creditFixture() });
    await fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(credits.issue.mock.calls[1]?.[1]).toEqual(request);
    expect(fixture.componentInstance['task'].completed()).toBe(true);
  });
  it('refuses a second credit', async () => {
    const { root } = await setupInvoicePage(CreditEditor, {
      credits: creditFixture(),
      invoice: { ...invoiceFixture(), creditedCents: 1200 },
    });
    expect(root.querySelector('form')).toBeNull();
  });
  it('keeps the reason when a version conflict requires reload', async () => {
    const { root, fixture, credits } = await setupInvoicePage(CreditEditor);
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    credits.issue.mockResolvedValue({ success: false, code: 'invoice.credit_conflict' });
    inputValue(field(root, 'textarea'), 'Keep this reason');
    submitForm(root);
    await fixture.whenStable();
    expect(field(root, 'textarea').value).toBe('Keep this reason');
    expect(fixture.componentInstance['task'].stale()).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(credits.issue).toHaveBeenCalledTimes(1);
  });
});
