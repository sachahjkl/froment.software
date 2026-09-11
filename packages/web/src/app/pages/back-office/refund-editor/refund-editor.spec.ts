import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { RefundEditor } from './refund-editor';
import {
  creditFixture,
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

describe('RefundEditor', () => {
  afterEach(() => vi.restoreAllMocks());
  it.each(['ng-valid', 'ng-invalid'])(
    'ignores unchanged %s dates but protects actual edits',
    async (animationName) => {
      const { root, fixture, credits } = await setupInvoicePage(RefundEditor, {
        credits: creditFixture(),
      });
      const editor = fixture.componentInstance;
      const confirmation = vi
        .spyOn(TestBed.inject(Confirmation), 'request')
        .mockResolvedValue(false);
      const form = editor['refundForm'];
      const loaded = form().value();
      notifyDateValidity(field(root, 'input[type="date"]'), animationName);
      await fixture.whenStable();
      expect(form.refundedOn().dirty()).toBe(true);
      expect(form().touched()).toBe(false);
      expect(form().value()).toEqual(loaded);
      expect(editor['hasUnsavedChanges']()).toBe(false);
      expect(await editor.canDeactivate()).toBe(true);
      const pristineUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(pristineUnload);
      expect(pristineUnload.defaultPrevented).toBe(false);
      submitForm(root);
      await fixture.whenStable();
      expect(credits.refund).not.toHaveBeenCalled();
      expect(confirmation).not.toHaveBeenCalled();
      const reference = field(root, '[aria-describedby="refund-reference-error"]');
      inputValue(reference, 'Unsaved refund');
      await fixture.whenStable();
      expect(await editor.canDeactivate()).toBe(false);
      const editedUnload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(editedUnload);
      expect(editedUnload.defaultPrevented).toBe(true);
      expect(reference.value).toBe('Unsaved refund');
      inputValue(reference, '');
      await fixture.whenStable();
      expect(form().dirty()).toBe(true);
      expect(editor['hasUnsavedChanges']()).toBe(false);
      expect(await editor.canDeactivate()).toBe(true);
      expect(confirmation).toHaveBeenCalledTimes(1);
    },
  );
  it('protects incomplete native input without a model change and rejects its submission', async () => {
    const { root, fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    const editor = fixture.componentInstance;
    const form = editor['refundForm'];
    const loaded = form().value();
    const date = field(root, 'input[type="date"]');
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(false);
    const badInput = vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(form().value()).toEqual(loaded);
    expect(form().dirty()).toBe(false);
    expect(form.refundedOn().errors()).toContainEqual(expect.objectContaining({ kind: 'parse' }));
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
    inputValue(field(root, 'input[inputmode="decimal"]'), '2.00');
    inputValue(field(root, '[aria-describedby="refund-reference-error"]'), 'REFUND-1');
    inputValue(date, '2026-08-22');
    vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    submitForm(root);
    await fixture.whenStable();
    expect(form.refundedOn().value()).toBe('2026-08-22');
    expect(document.activeElement).toBe(date);
    expect(credits.refund).not.toHaveBeenCalled();
    expect(confirmation).toHaveBeenCalledTimes(1);
  });
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
    expect(field(root, 'input[inputmode="decimal"]').disabled).toBe(true);
    expect(fixture.componentInstance['refundForm']().dirty()).toBe(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const uncertainUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(uncertainUnload);
    expect(uncertainUnload.defaultPrevented).toBe(true);
    submitForm(root);
    await fixture.componentInstance['reload']();
    expect(credits.refund).toHaveBeenCalledTimes(1);
    expect(credits.get).toHaveBeenCalledTimes(1);
    credits.refund.mockResolvedValue({ success: true, result: creditFixture() });
    await fixture.componentInstance['retry']();
    await fixture.whenStable();
    expect(credits.refund.mock.calls[1]?.[1]).toEqual(request);
    expect(fixture.componentInstance['task'].completed()).toBe(true);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    const completedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(completedUnload);
    expect(completedUnload.defaultPrevented).toBe(false);
    fixture.componentInstance['save'](new Event('submit', { cancelable: true }));
    await fixture.componentInstance['retry']();
    expect(credits.refund).toHaveBeenCalledTimes(2);
  });
  it('does not offer refunds without a credit note', async () => {
    const { root } = await setupInvoicePage(RefundEditor);
    expect(root.querySelector('form')).toBeNull();
  });
  it.each([
    'authentication.required',
    'authentication.permission_denied',
    'request.rate_limited',
    'request.invalid_origin',
    'request.too_large',
    'client.error',
  ] as const)(
    'retains an uncertain refund through %s and retries after access is restored',
    async (code) => {
      const { fixture, credits } = await setupInvoicePage(RefundEditor, {
        credits: creditFixture(),
      });
      const editor = fixture.componentInstance;
      const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
      editor['refundForm']().value.set({
        amount: '2.00',
        refundedOn: '2026-08-22',
        reference: 'REFUND-1',
      });
      credits.refund.mockRejectedValueOnce(new Error('response lost'));
      editor['save'](new Event('submit'));
      await fixture.whenStable();
      const request = credits.refund.mock.calls[0]?.[1];

      credits.refund.mockResolvedValueOnce({ success: false, code });
      await editor['retry']();
      await fixture.whenStable();
      expect(editor['task'].uncertain()).toBe(true);
      expect(editor['attempt']).toEqual(request);
      expect(await editor.canDeactivate()).toBe(false);
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      editor['save'](new Event('submit'));
      await editor['reload']();
      expect(credits.refund).toHaveBeenCalledTimes(2);

      confirmation.mockResolvedValueOnce(false);
      await editor['retry']();
      expect(editor['attempt']).toEqual(request);
      confirmation.mockRejectedValueOnce(new Error('confirmation interrupted'));
      await editor['retry']();
      expect(editor['task'].uncertain()).toBe(true);
      expect(editor['attempt']).toEqual(request);

      credits.refund.mockResolvedValueOnce({ success: true, result: creditFixture() });
      await editor['retry']();
      expect(credits.refund.mock.calls.map((call) => call[1])).toEqual([request, request, request]);
      expect(editor['task'].completed()).toBe(true);
      expect(editor['attempt']).toBeUndefined();
      expect(await editor.canDeactivate()).toBe(true);
    },
  );
  it.each(['request.invalid_origin', 'request.too_large'] as const)(
    'unlocks an initial %s refusal without an earlier uncertain attempt',
    async (code) => {
      const { fixture, credits } = await setupInvoicePage(RefundEditor, {
        credits: creditFixture(),
      });
      const editor = fixture.componentInstance;
      vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
      editor['refundForm']().value.set({
        amount: '2.00',
        refundedOn: '2026-08-22',
        reference: 'REFUND-1',
      });
      credits.refund.mockResolvedValueOnce({ success: false, code });
      editor['save'](new Event('submit'));
      await fixture.whenStable();
      expect(editor['task'].uncertain()).toBe(false);
      expect(editor['task'].locked()).toBe(false);
      expect(editor['attempt']).toBeUndefined();
      expect(editor['refundForm']().value().reference).toBe('REFUND-1');
    },
  );
  it('keeps an initial unclassified failure unresolved until the same request succeeds', async () => {
    const { fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    const editor = fixture.componentInstance;
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    editor['refundForm']().value.set({
      amount: '2.00',
      refundedOn: '2026-08-22',
      reference: 'REFUND-1',
    });
    credits.refund.mockResolvedValueOnce({ success: false, code: 'client.error' });
    editor['save'](new Event('submit'));
    await fixture.whenStable();
    const request = credits.refund.mock.calls[0]?.[1];
    expect(editor['task'].uncertain()).toBe(true);
    expect(editor['task'].stale()).toBe(false);
    expect(editor['attempt']).toEqual(request);
    expect(await editor.canDeactivate()).toBe(false);
    credits.refund.mockResolvedValueOnce({ success: true, result: creditFixture() });
    await editor['retry']();
    expect(credits.refund.mock.calls[1]?.[1]).toEqual(request);
    expect(editor['task'].completed()).toBe(true);
  });
  it('does not discard the request when another retry is already running', async () => {
    const { fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    const editor = fixture.componentInstance;
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    editor['refundForm']().value.set({
      amount: '2.00',
      refundedOn: '2026-08-22',
      reference: 'REFUND-1',
    });
    const response = Promise.withResolvers<{
      success: true;
      result: ReturnType<typeof creditFixture>;
    }>();
    credits.refund.mockReturnValueOnce(response.promise);
    editor['save'](new Event('submit'));
    await vi.waitFor(() => expect(credits.refund).toHaveBeenCalledTimes(1));
    const request = credits.refund.mock.calls[0]?.[1];
    await editor['retry']();
    expect(editor['attempt']).toEqual(request);
    response.resolve({ success: true, result: creditFixture() });
    await fixture.whenStable();
    expect(editor['task'].completed()).toBe(true);
  });
  it('resolves an uncertain refund when replay lookup returns a business rejection', async () => {
    const { fixture, credits } = await setupInvoicePage(RefundEditor, {
      credits: creditFixture(),
    });
    const editor = fixture.componentInstance;
    vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    editor['refundForm']().value.set({
      amount: '2.00',
      refundedOn: '2026-08-22',
      reference: 'REFUND-1',
    });
    credits.refund.mockRejectedValueOnce(new Error('response lost'));
    editor['save'](new Event('submit'));
    await fixture.whenStable();
    const request = credits.refund.mock.calls[0]?.[1];
    credits.refund.mockResolvedValueOnce({ success: false, code: 'invoice.credit_conflict' });
    await editor['retry']();
    expect(credits.refund.mock.calls[1]?.[1]).toEqual(request);
    expect(editor['task'].uncertain()).toBe(false);
    expect(editor['task'].stale()).toBe(true);
    expect(editor['attempt']).toBeUndefined();
  });
  it('keeps refund input protected after an HTTP 409 disables the stale form', async () => {
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
    const invoices = TestBed.inject(InvoicesApi);
    const getInvoice = vi
      .spyOn(invoices, 'get')
      .mockResolvedValue({ success: true, result: invoiceFixture() });
    const api = TestBed.inject(InvoiceCreditsApi);
    const getCredits = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ success: true, result: creditFixture() });
    const refund = vi.spyOn(api, 'refund');
    const http = TestBed.inject(HttpTestingController);
    const confirmation = vi.spyOn(TestBed.inject(Confirmation), 'request').mockResolvedValue(true);
    const fixture = TestBed.createComponent(RefundEditor);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    const task = editor['task'];
    const root: HTMLElement = fixture.nativeElement;
    const amount = field(root, 'input[inputmode="decimal"]');
    const reference = field(root, '[aria-describedby="refund-reference-error"]');
    inputValue(amount, '2.00');
    inputValue(reference, 'Retained refund');
    inputValue(field(root, 'input[type="date"]'), '2026-08-22');
    const values = editor['refundForm']().value();
    submitForm(root);
    await vi.waitFor(() => expect(refund).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(amount.disabled).toBe(true));
    expect(task.busy()).toBe(true);
    expect(await editor.canDeactivate()).toBe(false);
    const pendingUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pendingUnload);
    expect(pendingUnload.defaultPrevented).toBe(true);
    submitForm(root);
    expect(refund).toHaveBeenCalledTimes(1);
    const request = http.expectOne(`/api/invoices/${invoiceId}/refunds`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({ amountCents: 200, refundedOn: '2026-08-22' });
    request.flush(
      { _tag: 'InvoiceCreditConflict', code: 'invoice.credit_conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    await expect(refund.mock.results[0]?.value).resolves.toMatchObject({
      success: false,
      status: 409,
      code: 'invoice.credit_conflict',
    });
    expect(task.stale()).toBe(true);
    expect(task.busy()).toBe(false);
    expect(task.uncertain()).toBe(false);
    expect(editor['refundForm']().disabled()).toBe(true);
    expect(editor['refundForm']().dirty()).toBe(false);
    expect(editor['refundForm']().value()).toEqual(values);
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
    expect(refund).toHaveBeenCalledTimes(1);
    expect(getInvoice).toHaveBeenCalledTimes(1);
    expect(getCredits).toHaveBeenCalledTimes(1);
    expect(reference.value).toBe('Retained refund');
    expect(editor['refundForm']().value()).toEqual(values);
    confirmation.mockResolvedValue(true);
    await editor['reload']();
    await fixture.whenStable();
    notifyDateValidity(field(root, 'input[type="date"]'));
    await fixture.whenStable();
    expect(getInvoice).toHaveBeenCalledTimes(2);
    expect(task.stale()).toBe(false);
    expect(editor['hasUnsavedChanges']()).toBe(false);
    expect(editor['refundForm']().value()).toEqual({ amount: '', refundedOn: '', reference: '' });
    expect(await editor.canDeactivate()).toBe(true);
    const reloadedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(reloadedUnload);
    expect(reloadedUnload.defaultPrevented).toBe(false);
    http.verify();
  });
});
