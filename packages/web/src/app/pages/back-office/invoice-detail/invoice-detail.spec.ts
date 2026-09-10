import { InvoiceDetail } from './invoice-detail';
import {
  invoiceFixture,
  invoiceId,
  paymentFixture,
  setupInvoicePage,
} from '../billing/billing.spec-helper';

describe('InvoiceDetail', () => {
  it('keeps the summary read-only and links to dedicated tasks', async () => {
    const { root } = await setupInvoicePage(InvoiceDetail);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
    expect(
      root.querySelector(`a[href="/backoffice/invoices/${invoiceId}/payments/new"]`),
    ).not.toBeNull();
    expect(root.querySelector('a[href*="/backoffice/courriels/new?invoice="]')).not.toBeNull();
    expect(
      root.querySelector('a[href*="/backoffice/courriels/reminders/new?invoice="]'),
    ).not.toBeNull();
  });
  it('shows the saved PDF and preview without changing issued revisions', async () => {
    const { root, api } = await setupInvoicePage(InvoiceDetail, { query: { tab: 'document' } });
    expect(root.querySelector('iframe')?.getAttribute('src')).toBe(
      `/api/invoices/${invoiceId}/revisions/2/preview`,
    );
    expect(root.querySelector('iframe')?.hasAttribute('sandbox')).toBe(false);
    expect(
      root.querySelector(`a[href="/api/invoices/${invoiceId}/revisions/2/pdf"]`),
    ).not.toBeNull();
    expect(api.renderPdf).not.toHaveBeenCalled();
  });
  it('excludes cancelled receipt amounts and retains their cancellation reason', async () => {
    const payment = {
      ...paymentFixture(),
      cancelledAt: '2026-08-22T06:00:00.000Z',
      cancellationReason: 'Wrong receipt',
    };
    const { root, fixture } = await setupInvoicePage(InvoiceDetail, {
      invoice: { ...invoiceFixture(), payments: [payment] },
      query: { tab: 'receipts' },
    });
    expect(fixture.componentInstance['paid']()).toBe(0);
    expect(root.textContent).toContain('Wrong receipt');
    expect(root.querySelector('form')).toBeNull();
  });
  it('uses only recorded history and never synthesizes events from dates', async () => {
    const { root, api } = await setupInvoicePage(InvoiceDetail, { query: { tab: 'history' } });
    expect(api.history).toHaveBeenCalledWith(invoiceId);
    expect(root.querySelector('.history-entry')).toBeNull();
    expect(root.textContent).toMatch(/Aucun événement|No recorded events/);
  });
  it('replaces previously loaded history with a limit error and clears it after a successful reload', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceDetail, {
      query: { tab: 'history' },
    });
    api.history.mockResolvedValue({
      success: true,
      result: [
        {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FB9',
          action: 'invoice.issued',
          actorUserId: null,
          resourceType: 'invoice',
          resourceId: invoiceId,
          requestId: null,
          traceId: null,
          spanId: null,
          occurredAt: '2026-08-20T06:00:00.000Z',
          metadata: { version: '2' },
        },
      ],
    });
    fixture.componentInstance['history'].reload();
    await fixture.whenStable();
    expect(root.querySelectorAll('.history-entry')).toHaveLength(1);
    api.history.mockResolvedValue({ success: false, status: 413, code: 'invoice.workspace_limit' });
    fixture.componentInstance['history'].reload();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(
      /Trop de résultats|Too many results/,
    );
    expect(root.querySelector('ol')).toBeNull();
    expect(fixture.componentInstance['events']()).toBeUndefined();
    expect(root.textContent).not.toMatch(/Aucun événement|No recorded events/);
    api.history.mockResolvedValue({ success: true, result: [] });
    fixture.componentInstance['history'].reload();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.textContent).toMatch(/Aucun événement|No recorded events/);
  });
});
