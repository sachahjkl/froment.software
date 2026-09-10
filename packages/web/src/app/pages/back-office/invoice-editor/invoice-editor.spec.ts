import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { Confirmation } from '@shared/confirmation/confirmation';
import { InvoiceEditor } from './invoice-editor';
import {
  field,
  inputValue,
  invoiceFixture,
  invoiceId,
  orderId,
  setupInvoicePage,
  submitForm,
} from '../billing/billing.spec-helper';

describe('InvoiceEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('keeps issued invoices read-only and moves financial tasks out of the editor', async () => {
    const { root } = await setupInvoicePage(InvoiceEditor);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector(`a[href="/backoffice/invoices/${invoiceId}"]`)).not.toBeNull();
    expect(root.querySelector('.payment-form')).toBeNull();
  });
  it('saves a version and keeps refreshParties explicit', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    const revised = { ...invoiceFixture('draft'), version: 3 };
    api.createRevision.mockResolvedValue({ success: true, result: revised });
    inputValue(field(root, 'input[type="text"]'), 'Changed title');
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({
        expectedVersion: 2,
        refreshParties: false,
        title: 'Changed title',
      }),
    );
    const refresh = field(root, 'input[type="checkbox"]');
    refresh.click();
    await fixture.whenStable();
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).toHaveBeenLastCalledWith(
      invoiceId,
      expect.objectContaining({ expectedVersion: 3, refreshParties: true }),
    );
  });
  it('retains edited values on conflict and requires reload before another save', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    api.createRevision.mockResolvedValue({ success: false, code: 'invoice.version_conflict' });
    inputValue(field(root, 'input[type="text"]'), 'Unsaved title');
    submitForm(root);
    await fixture.whenStable();
    expect(field(root, 'input[type="text"]').value).toBe('Unsaved title');
    expect(fixture.componentInstance['stale']()).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).toHaveBeenCalledTimes(1);
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(false);
    await fixture.componentInstance['reload']();
    await fixture.whenStable();
    expect(field(root, 'input[type="text"]').value).toBe('Unsaved title');
    expect(fixture.componentInstance['invoiceForm'].title().value()).toBe('Unsaved title');
    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance['stale']()).toBe(true);
    expect(fixture.componentInstance['totalsAreStale']()).toBe(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirmation).toHaveBeenCalledTimes(2);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(field(root, 'input[type="text"]').value).toBe('Unsaved title');
    confirmation.mockResolvedValue(true);
    await fixture.componentInstance['reload']();
    await fixture.whenStable();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(field(root, 'input[type="text"]').value).toBe('Audit');
    expect(fixture.componentInstance['stale']()).toBe(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });
  it('validates dates and lines, then focuses the first invalid field', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    const dates = root.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const from = dates.item(0);
    const to = dates.item(1);
    inputValue(from, '2026-10-20');
    inputValue(to, '2026-09-20');
    inputValue(field(root, 'fieldset input'), ' ');
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(to);
    expect(to.getAttribute('aria-describedby')).toBe('invoice-due-date-error');
  });
  it('creates from an order and navigates to the read-only detail', async () => {
    const invoice = invoiceFixture('draft');
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      params: {},
      query: { orderId },
      orders: [
        {
          id: orderId,
          reference: 'CO-2026-000001',
          quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAS',
          quoteReference: 'DE-2026-000001',
          revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
          clientId: invoice.clientId,
          clientDisplayName: 'Acme',
          title: 'Audit',
          currency: 'EUR',
          totalCents: 1200,
          createdAt: '2026-08-20T06:00:00.000Z',
          invoiceId: null,
        },
      ],
    });
    await fixture.whenStable();
    api.create.mockResolvedValue({ success: true, result: invoice });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(field(root, 'select').value).toBe(orderId);
    const dates = root.querySelectorAll<HTMLInputElement>('input[type="date"]');
    inputValue(dates.item(0), '2026-08-20');
    inputValue(dates.item(1), '2026-09-20');
    submitForm(root);
    await fixture.whenStable();
    expect(api.create).toHaveBeenCalledWith({
      orderId,
      serviceDate: '2026-08-20',
      dueDate: '2026-09-20',
      paymentTerms: '',
    });
    expect(navigate).toHaveBeenCalledWith(['/backoffice/invoices', invoiceId], {
      replaceUrl: true,
    });
  });
  it('protects pending saves and dirty forms from navigation and reload', async () => {
    const { root, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    inputValue(field(root, 'input[type="text"]'), 'Unsaved');
    await fixture.whenStable();
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    fixture.componentInstance['saving'].set(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
  });
});
