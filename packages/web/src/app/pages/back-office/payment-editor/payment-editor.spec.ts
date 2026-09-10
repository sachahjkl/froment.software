import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
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

function notifyDateValidity(input: HTMLInputElement, animationName = 'ng-invalid'): void {
  const event = new Event('animationstart');
  Object.defineProperty(event, 'animationName', { value: animationName });
  input.dispatchEvent(event);
}

describe('PaymentEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it('keeps the allowed list context and follows the current tab on its detail return link', async () => {
    const query = {
      billingList: 'receipts',
      billingQ: 'BANK',
      billingStatus: 'active',
      billingSort: 'amount-desc',
      tab: 'receipts',
    };
    const { fixture, queryParams } = await setupInvoicePage(PaymentEditor, { query });
    const task = fixture.componentInstance['task'];
    expect(task.navigation.listLink()).toBe('/backoffice/facturation/encaissements');
    expect(task.navigation.listQuery()).toEqual({
      q: 'BANK',
      status: 'active',
      sort: 'amount-desc',
    });
    queryParams.next(
      convertToParamMap({ ...query, tab: 'history', returnUrl: '//outside.example' }),
    );
    await fixture.whenStable();
    const link = fixture.debugElement
      .query(By.css('a[href^="/backoffice/invoices/"]'))
      .injector.get(RouterLink);
    expect(link.queryParams).toEqual({ ...query, tab: 'history' });
    expect(link.queryParams).not.toHaveProperty('returnUrl');
  });
  it.each(['ng-valid', 'ng-invalid'])(
    'ignores unchanged %s dates but protects actual edits',
    async (animationName) => {
      const { root, fixture, api } = await setupInvoicePage(PaymentEditor);
      const editor = fixture.componentInstance;
      const confirmation = vi
        .spyOn(TestBed.inject(Confirmation), 'request')
        .mockResolvedValue(false);
      const form = editor['paymentForm'];
      const loaded = form().value();
      notifyDateValidity(field(root, 'input[type="date"]'), animationName);
      await fixture.whenStable();
      expect(form.paidOn().dirty()).toBe(true);
      expect(form().touched()).toBe(false);
      expect(form().value()).toEqual(loaded);
      expect(editor['hasUnsavedChanges']()).toBe(false);
      expect(await editor.canDeactivate()).toBe(true);
      const pristineUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(pristineUnload);
      expect(pristineUnload.defaultPrevented).toBe(false);
      submitForm(root);
      await fixture.whenStable();
      expect(api.recordPayment).not.toHaveBeenCalled();
      expect(confirmation).not.toHaveBeenCalled();
      const reference = field(root, '[aria-describedby="payment-reference-error"]');
      inputValue(reference, 'Unsaved receipt');
      await fixture.whenStable();
      expect(await editor.canDeactivate()).toBe(false);
      const editedUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(editedUnload);
      expect(editedUnload.defaultPrevented).toBe(true);
      expect(reference.value).toBe('Unsaved receipt');
      inputValue(reference, '');
      await fixture.whenStable();
      expect(form().dirty()).toBe(true);
      expect(editor['hasUnsavedChanges']()).toBe(false);
      expect(await editor.canDeactivate()).toBe(true);
      expect(confirmation).toHaveBeenCalledTimes(1);
    },
  );
  it('protects incomplete native input without a model change and rejects its submission', async () => {
    const { root, fixture, api } = await setupInvoicePage(PaymentEditor);
    const editor = fixture.componentInstance;
    const form = editor['paymentForm'];
    const loaded = form().value();
    const date = field(root, 'input[type="date"]');
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(false);
    const badInput = vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form().value()).toEqual(loaded);
    expect(form().dirty()).toBe(false);
    expect(form.paidOn().errors()).toContainEqual(expect.objectContaining({ kind: 'parse' }));
    expect(editor['hasUnsavedChanges']()).toBe(true);
    expect(await editor.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    badInput.mockRestore();
    notifyDateValidity(date);
    await fixture.whenStable();
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(await editor.canDeactivate()).toBe(true);
    inputValue(field(root, 'input[inputmode="decimal"]'), '4.00');
    inputValue(field(root, '[aria-describedby="payment-reference-error"]'), 'BANK-456');
    inputValue(date, '2026-08-20');
    vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    submitForm(root);
    await fixture.whenStable();
    expect(form.paidOn().value()).toBe('2026-08-20');
    expect(document.activeElement).toBe(date);
    expect(api.recordPayment).not.toHaveBeenCalled();
    expect(confirmation).toHaveBeenCalledTimes(1);
  });
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
    expect(root.querySelectorAll('[data-task-feedback] [role="alert"]')).toHaveLength(1);
    expect(fixture.componentInstance['paymentForm']().dirty()).toBe(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const uncertainUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(uncertainUnload);
    expect(uncertainUnload.defaultPrevented).toBe(true);
    submitForm(root);
    await fixture.componentInstance['reload']();
    expect(api.recordPayment).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledTimes(1);
    api.recordPayment.mockResolvedValue({ success: true, result: invoiceFixture() });
    await fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(api.recordPayment).toHaveBeenLastCalledWith(invoiceId, request);
    expect(fixture.componentInstance['task'].completed()).toBe(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    const completedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(completedUnload);
    expect(completedUnload.defaultPrevented).toBe(false);
    fixture.componentInstance['save'](new Event('submit', { cancelable: true }));
    await fixture.componentInstance['retry']();
    expect(api.recordPayment).toHaveBeenCalledTimes(2);
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
  it('keeps receipt input protected after an HTTP 409 disables the stale form', async () => {
    const params = convertToParamMap({ invoiceId });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(params),
            queryParamMap: of(convertToParamMap({})),
            snapshot: { paramMap: params, queryParamMap: convertToParamMap({}) },
          },
        },
      ],
    });
    const api = TestBed.inject(InvoicesApi);
    const get = vi.spyOn(api, 'get').mockResolvedValue({ success: true, result: invoiceFixture() });
    const record = vi.spyOn(api, 'recordPayment');
    const http = TestBed.inject(HttpTestingController);
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PaymentEditor);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    const task = editor['task'];
    const root: HTMLElement = fixture.nativeElement;
    const amount = field(root, 'input[inputmode="decimal"]');
    const reference = field(root, '[aria-describedby="payment-reference-error"]');
    inputValue(amount, '4.00');
    inputValue(reference, 'Retained receipt');
    inputValue(field(root, 'input[type="date"]'), '2026-08-20');
    const values = editor['paymentForm']().value();
    submitForm(root);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(amount.disabled).toBe(true));
    expect(task.busy()).toBe(true);
    expect(await editor.canDeactivate()).toBe(false);
    const pendingUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);
    submitForm(root);
    expect(record).toHaveBeenCalledTimes(1);
    const request = http.expectOne(`/api/invoices/${invoiceId}/payments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ expectedVersion: 2, amountCents: 400 });
    request.flush(
      { _tag: 'InvoiceVersionConflict', code: 'invoice.version_conflict', currentVersion: 3 },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    await expect(record.mock.results[0]?.value).resolves.toMatchObject({
      success: false,
      status: 409,
      code: 'invoice.version_conflict',
    });
    expect(task.stale()).toBe(true);
    expect(root.querySelectorAll('[data-task-feedback] [role="alert"]')).toHaveLength(1);
    expect(task.busy()).toBe(false);
    expect(task.uncertain()).toBe(false);
    expect(editor['paymentForm']().disabled()).toBe(true);
    expect(editor['paymentForm']().dirty()).toBe(false);
    expect(editor['paymentForm']().value()).toEqual(values);
    expect(amount.disabled).toBe(true);
    confirmation.mockResolvedValue(false);
    expect(await editor.canDeactivate()).toBe(false);
    expect(await task.canDeactivate(false)).toBe(false);
    const staleUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(staleUnload);
    expect(staleUnload.defaultPrevented).toBe(true);
    const disabledUnload = new Event('beforeunload', { cancelable: true });
    task.beforeUnload(disabledUnload, false);
    expect(disabledUnload.defaultPrevented).toBe(true);
    submitForm(root);
    await editor['reload']();
    expect(record).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledTimes(1);
    expect(reference.value).toBe('Retained receipt');
    expect(editor['paymentForm']().value()).toEqual(values);
    confirmation.mockResolvedValue(true);
    await editor['reload']();
    await fixture.whenStable();
    notifyDateValidity(field(root, 'input[type="date"]'));
    await fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
    expect(task.stale()).toBe(false);
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(editor['paymentForm']().value()).toEqual({
      amount: '',
      paidOn: '',
      method: 'transfer',
      reference: '',
    });
    expect(await editor.canDeactivate()).toBe(true);
    const reloadedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reloadedUnload);
    expect(reloadedUnload.defaultPrevented).toBe(false);
    http.verify();
  });
});
