import { vi } from 'vitest';
import { DocumentIncomplete } from '@froment/contracts';
import { Confirmation } from '@shared/confirmation/confirmation';
import { InvoiceIssue } from './invoice-issue';
import {
  field,
  invoiceFixture,
  invoiceId,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('InvoiceIssue', () => {
  afterEach(() => vi.restoreAllMocks());
  it('requires review and issues exactly the displayed version', async () => {
    const { root, fixture, api } = await setupInvoicePage(InvoiceIssue, {
      invoice: invoiceFixture('draft'),
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.issue).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(field(root, 'input[type="checkbox"]'));
    field(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    api.issue.mockResolvedValue({
      success: true,
      result: {
        invoiceId,
        revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        version: 3,
        status: 'issued',
        invoiceNumber: 'FA-2026-000001',
        issuedAt: '2026-08-21T06:00:00.000Z',
      },
    });
    submitForm(root);
    await fixture.whenStable();
    expect(api.issue).toHaveBeenCalledWith(invoiceId, 2);
    expect(fixture.componentInstance['task'].completed()).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.issue).toHaveBeenCalledTimes(1);
  });
  it('shows a recoverable document problem without changing the draft', async () => {
    const { root, fixture, api } = await setupInvoicePage(InvoiceIssue, {
      invoice: invoiceFixture('draft'),
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    field(root, 'input[type="checkbox"]').click();
    await fixture.whenStable();
    api.issue.mockResolvedValue({
      success: false,
      code: 'document.incomplete',
      failure: new DocumentIncomplete({
        code: 'document.incomplete',
        issues: [{ party: 'client', field: 'addressLine1', reason: 'required' }],
      }),
    });
    submitForm(root);
    await fixture.whenStable();
    expect(fixture.componentInstance['task'].completed()).toBe(false);
    expect(fixture.componentInstance['task'].invoice()?.status).toBe('draft');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-task-feedback] [role="alert"]')).toHaveLength(1);
    expect(fixture.componentInstance['task'].issues()).toEqual([
      { party: 'client', field: 'addressLine1', reason: 'required' },
    ]);
    expect(root.querySelector('app-document-issues')).not.toBeNull();
  });
});
