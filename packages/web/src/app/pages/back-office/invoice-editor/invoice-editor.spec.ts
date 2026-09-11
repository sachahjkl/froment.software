import { provideAccount } from '@backoffice/account.spec-helper';
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

function notifyDateValidity(input: HTMLInputElement): void {
  const event = new Event('animationstart');
  Object.defineProperty(event, 'animationName', { value: 'ng-valid' });
  input.dispatchEvent(event);
}

describe('InvoiceEditor', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  afterEach(() => vi.restoreAllMocks());
  it('keeps issued invoices read-only and moves financial tasks out of the editor', async () => {
    const { root } = await setupInvoicePage(InvoiceEditor);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector(`a[href="/backoffice/invoices/${invoiceId}"]`)).not.toBeNull();
    expect(root.querySelector('.payment-form')).toBeNull();
  });
  it('keeps loaded values pristine through date-validity animations, submission and reload', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    const editor = fixture.componentInstance;
    const form = editor['invoiceForm'];
    const loaded = structuredClone(form().value());
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(false);
    expect(form().dirty()).toBe(false);
    for (const date of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
      notifyDateValidity(date);
    }
    await fixture.whenStable();
    // Chromium déclenche ces animations sans saisie. Angular marque les deux dates comme dirty.
    expect(form.serviceDate().dirty()).toBe(true);
    expect(form.dueDate().dirty()).toBe(true);
    expect(form.title().dirty()).toBe(false);
    expect(form().touched()).toBe(false);
    expect(structuredClone(form().value())).toEqual(loaded);
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(editor['totalsAreStale']()).toBe(false);
    expect(root.querySelector('.saved-summary [appNotice]')).toBeNull();
    const save = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(false);
    save.click();
    await fixture.whenStable();
    expect(api.createRevision).not.toHaveBeenCalled();
    expect(editor['completed']()).toBe(false);
    expect(await editor.canDeactivate()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await editor['reload']();
    await fixture.whenStable();
    for (const date of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
      notifyDateValidity(date);
    }
    await fixture.whenStable();
    expect(structuredClone(form().value())).toEqual(loaded);
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(editor['totalsAreStale']()).toBe(false);
    expect(await editor.canDeactivate()).toBe(true);
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.createRevision).not.toHaveBeenCalled();
    expect(confirmation).not.toHaveBeenCalled();
  });
  it('protects incomplete native date input even when parsing leaves the model unchanged', async () => {
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: invoiceFixture('draft'),
    });
    const editor = fixture.componentInstance;
    const form = editor['invoiceForm'];
    const loaded = form().value();
    const date = field(root, 'input[aria-describedby="invoice-service-date-error"]');
    const badInput = vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form().value()).toEqual(loaded);
    expect(form.serviceDate().invalid()).toBe(true);
    expect(editor['hasUnsavedChanges']()).toBe(true);
    expect(editor['totalsAreStale']()).toBe(true);
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(false);
    expect(await editor.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const save = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(false);
    save.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(date);
    expect(api.createRevision).not.toHaveBeenCalled();
    badInput.mockRestore();
    notifyDateValidity(date);
    await fixture.whenStable();
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(editor['totalsAreStale']()).toBe(false);
    expect(await editor.canDeactivate()).toBe(true);
    expect(confirmation).toHaveBeenCalledTimes(1);
  });
  it('validates an unchanged invalid draft before skipping revision creation', async () => {
    const invoice = invoiceFixture('draft');
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      invoice: {
        ...invoice,
        currentRevision: { ...invoice.currentRevision, dueDate: '2026-08-19' },
      },
    });
    expect(fixture.componentInstance['hasUnsavedChanges']()).toBe(false);
    const save = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(false);
    save.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(
      field(root, 'input[aria-describedby="invoice-due-date-error"]'),
    );
    expect(api.createRevision).not.toHaveBeenCalled();
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
    for (const date of root.querySelectorAll<HTMLInputElement>('input[type="date"]')) {
      notifyDateValidity(date);
    }
    await fixture.whenStable();
    expect(fixture.componentInstance['hasUnsavedChanges']()).toBe(false);
    expect(fixture.componentInstance['totalsAreStale']()).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).toHaveBeenCalledTimes(1);
    const refresh = field(root, 'input[type="checkbox"]');
    refresh.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
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
    await fixture.whenStable();
    const save = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(save.disabled).toBe(false);
    expect(root.querySelector('form')!.noValidate).toBe(true);
    save.click();
    await fixture.whenStable();
    expect(api.createRevision).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(to);
    expect(to.getAttribute('aria-describedby')).toBe('invoice-due-date-error');
  });
  it('creates from an order and navigates to the read-only detail', async () => {
    const invoice = invoiceFixture('draft');
    const { root, api, fixture } = await setupInvoicePage(InvoiceEditor, {
      params: {},
      query: {
        orderId,
        billingList: 'invoices',
        billingQ: 'Audit',
        billingSort: 'total-desc',
        returnUrl: '//outside.example',
      },
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
          pdfAvailable: false,
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
      queryParams: expect.objectContaining({
        billingList: 'invoices',
        billingQ: 'Audit',
        billingSort: 'total-desc',
      }),
    });
    expect(navigate.mock.calls[0]?.[1]?.queryParams).not.toHaveProperty('orderId');
    expect(navigate.mock.calls[0]?.[1]?.queryParams).not.toHaveProperty('returnUrl');
    expect(fixture.componentInstance['hasUnsavedChanges']()).toBe(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.create).toHaveBeenCalledTimes(1);
  });
  it('protects pending saves and dirty forms from navigation and reload', async () => {
    const { root, fixture, api } = await setupInvoicePage(InvoiceEditor, {
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
    await fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    submitForm(root);
    await fixture.whenStable();
    expect(api.createRevision).not.toHaveBeenCalled();
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
  });
});
