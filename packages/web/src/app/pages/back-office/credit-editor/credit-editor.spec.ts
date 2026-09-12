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
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
  it('requires a reason and confirms one immutable full credit', async () => {
    const { fixture, root, credits } = await setupInvoicePage(CreditEditor);
    submitForm(root);
    await fixture.whenStable();
    expect(credits.issue).not.toHaveBeenCalled();
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    inputValue(field(root, 'textarea'), 'Cancelled service');
    inputValue(field(root, '.quantity-input'), '1.000');
    await fixture.componentInstance['issue']();
    expect(credits.issue).not.toHaveBeenCalled();
    confirmation.mockResolvedValue(true);
    const draft = {
      ...creditFixture().creditNotes[0]!,
      status: 'draft' as const,
      number: null,
      issueRequestId: null,
      issuedAt: null,
      issuedByUserId: null,
    };
    credits.create.mockRejectedValueOnce(new Error('offline'));
    await fixture.componentInstance['issue']();
    const request = credits.create.mock.calls[0]?.[0];
    expect(request).toMatchObject({ reason: 'Cancelled service' });
    credits.create.mockResolvedValue({ success: true, result: draft });
    credits.issue.mockResolvedValue({ success: true, result: creditFixture().creditNotes[0]! });
    await fixture.componentInstance['issue']();
    expect(credits.create.mock.calls[1]?.[0]).toEqual(request);
    expect(credits.issue).toHaveBeenCalledTimes(1);
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
    credits.create.mockResolvedValue({ success: false, code: 'invoice.credit_conflict' });
    inputValue(field(root, 'textarea'), 'Keep this reason');
    inputValue(field(root, '.quantity-input'), '1.000');
    await fixture.componentInstance['issue']();
    expect(field(root, 'textarea').value).toBe('Keep this reason');
    expect(fixture.componentInstance['task'].error()).toBe('invoice.credit_conflict');
    await fixture.componentInstance['issue']();
    expect(credits.create).toHaveBeenCalledTimes(1);
  });
});
