import { InvoiceDetail } from './invoice-detail';
import { convertToParamMap } from '@angular/router';
import {
  invoiceFixture,
  invoiceId,
  paymentFixture,
  setupInvoicePage,
} from '../billing/billing.spec-helper';

describe('InvoiceDetail', () => {
  it('keeps downloads available without write actions, audit requests or render previews', async () => {
    const { root, api, fixture, queryParams } = await setupInvoicePage(InvoiceDetail, {
      permissions: ['invoice.read', 'order.read', 'payment.read', 'document.download'],
      query: { tab: 'history' },
    });
    expect(api.history).not.toHaveBeenCalled();
    expect(root.querySelector('a[href$="/payments/new"]')).toBeNull();
    queryParams.next(convertToParamMap({ tab: 'document' }));
    await fixture.whenStable();
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('a[download]')).not.toBeNull();
    expect(api.renderPdf).not.toHaveBeenCalled();
  });
  it('loads refunds only when the receipts tab has active payments to cancel', async () => {
    const { credits, fixture } = await setupInvoicePage(InvoiceDetail, {
      query: { tab: 'receipts' },
    });
    expect(credits.get).not.toHaveBeenCalled();
    fixture.componentInstance['task'].invoice.set({
      ...invoiceFixture(),
      payments: [paymentFixture()],
    });
    await fixture.whenStable();
    expect(credits.get).toHaveBeenCalledWith(invoiceId);
  });

  it('reloads refund eligibility for a new invoice version and blocks failed refund loads', async () => {
    const payment = paymentFixture();
    const invoice = { ...invoiceFixture(), payments: [payment] };
    const { credits, fixture } = await setupInvoicePage(InvoiceDetail, {
      invoice,
      query: { tab: 'receipts' },
    });
    const component = fixture.componentInstance;
    expect(component['canCancelPayment'](invoice, payment, component['creditState']())).toBe(true);
    credits.get.mockRejectedValueOnce(new Error('refunds.unavailable'));
    component['task'].invoice.set({ ...invoice, version: invoice.version + 1 });
    expect(component['creditState']()).toBeUndefined();
    await fixture.whenStable();
    expect(credits.get).toHaveBeenCalledTimes(2);
    expect(component['canCancelPayment'](invoice, payment, component['creditState']())).toBe(false);
    component['credits'].reload();
    await fixture.whenStable();
    expect(component['canCancelPayment'](invoice, payment, component['creditState']())).toBe(true);
  });
  it('keeps the summary read-only and links to dedicated tasks', async () => {
    const { root } = await setupInvoicePage(InvoiceDetail);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('input')).toBeNull();
    expect(
      root.querySelector(`a[href="/backoffice/invoices/${invoiceId}/payments/new"]`),
    ).not.toBeNull();
    expect(root.querySelector('a[href*="/backoffice/emails/new?invoice="]')).not.toBeNull();
    expect(
      root.querySelector('a[href*="/backoffice/emails/reminders/new?invoice="]'),
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
