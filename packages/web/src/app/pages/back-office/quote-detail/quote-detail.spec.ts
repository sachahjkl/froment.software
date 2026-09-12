import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import {
  commercialTestRoutes,
  control,
  inputValue,
  orderFixture,
  quoteFixture,
  quoteId,
  selectValue,
} from './commercial.spec-helper';

async function openCancellation(harness: RouterTestingHarness, root: ParentNode): Promise<void> {
  control<HTMLButtonElement>(root, 'app-action-menu button').click();
  await harness.fixture.whenStable();
  control<HTMLButtonElement>(document, '[role="menuitem"][data-danger="true"]').click();
  await harness.fixture.whenStable();
}

describe('Quote detail', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  const get = vi.fn();
  const cancel = vi.fn();
  const confirm = vi.fn();
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ success: true, result: quoteFixture });
    cancel
      .mockReset()
      .mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'cancelled' } });
    confirm.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(commercialTestRoutes),
        { provide: QuotesApi, useValue: { get, cancel } },
        { provide: OrdersApi, useValue: { list: async () => [] } },
        { provide: Confirmation, useValue: { request: confirm } },
      ],
    });
  });
  it('separates the read-only summary, document and version tabs', async () => {
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('#quote-name')).toBeNull();
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector(`a[href="/backoffice/quotes/${quoteId}/edit"]`)).not.toBeNull();
    expect(
      root.querySelector(`a[href="/backoffice/quotes/${quoteId}/publication"]`),
    ).not.toBeNull();
    control<HTMLAnchorElement>(root, '#quote-versions-tab').click();
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('First version');
    control<HTMLAnchorElement>(
      root,
      `a[href="/backoffice/quotes/${quoteId}/document?version=1"]`,
    ).click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/document?version=1');
    expect(control<HTMLIFrameElement>(root, 'iframe').getAttribute('src')).toBe(
      `/api/quotes/${quoteId}/revisions/1/preview`,
    );
  });
  it('does not offer signature link management without send permission', async () => {
    TestBed.configureTestingModule({ providers: [provideAccount(['quote.read'])] });
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'sent' } });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    expect(
      harness.fixture.nativeElement.querySelector(
        `a[href="/backoffice/quotes/${quoteId}/publication"]`,
      ),
    ).toBeNull();
  });
  it('requires a reason and confirmation for cancellation', async () => {
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    await openCancellation(harness, root);
    control<HTMLButtonElement>(root, '.cancel-quote').click();
    await harness.fixture.whenStable();
    expect(cancel).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector('select'));
    expect(control<HTMLSelectElement>(root, 'select').getAttribute('aria-invalid')).toBe('true');
    const reason = control<HTMLSelectElement>(root, 'select');
    selectValue(reason, 'scope-changed');
    await harness.fixture.whenStable();
    expect(reason.getAttribute('aria-invalid')).toBe('false');
    expect(confirm).not.toHaveBeenCalled();
    control<HTMLButtonElement>(root, '.cancel-quote').click();
    await harness.fixture.whenStable();
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(quoteId, {
      expectedVersion: 2,
      reason: 'scope-changed',
      note: '',
    });
    expect(root.querySelector('.cancel-quote')).toBeNull();
  });
  it('keeps revisions in fixed ascending version order without mutating the response', async () => {
    const revisions = quoteFixture.revisions.toReversed();
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, revisions } });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}/versions`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('tbody th')?.textContent).toContain('First version');
    expect(root.querySelector('[appTableSort]')).toBeNull();
    expect(revisions[0]?.version).toBe(2);
  });
  it('opens the order for an accepted quote and removes edit and cancel actions', async () => {
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'accepted' } });
    TestBed.overrideProvider(OrdersApi, { useValue: { list: async () => [orderFixture] } });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector(`a[href="/backoffice/orders/${orderFixture.id}"]`)).not.toBeNull();
    expect(root.querySelector(`a[href="/backoffice/quotes/${quoteId}/edit"]`)).toBeNull();
    expect(root.querySelector('.cancel-quote')).toBeNull();
  });
  it('keeps cancellation annotations between tabs and warns before leaving', async () => {
    confirm.mockResolvedValue(false);
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    await openCancellation(harness, root);
    inputValue(root, 'textarea', 'Scope changed after review.');
    const reason = control<HTMLSelectElement>(root, 'select');
    selectValue(reason, 'scope-changed');
    control<HTMLAnchorElement>(root, '#quote-versions-tab').click();
    await harness.fixture.whenStable();
    expect(confirm).not.toHaveBeenCalled();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affairs');
    expect(TestBed.inject(Router).url).toContain('/versions');
    expect(confirm).toHaveBeenCalledOnce();
    control<HTMLAnchorElement>(root, '#quote-summary-tab').click();
    await harness.fixture.whenStable();
    expect(control<HTMLSelectElement>(root, 'select').value).toBe('scope-changed');
    expect(control<HTMLTextAreaElement>(root, 'textarea').value).toBe(
      'Scope changed after review.',
    );
    expect(root.querySelector('.document-cancellation')).not.toBeNull();
    expect(cancel).not.toHaveBeenCalled();
  });
  it('locks a real confirmation without disabling its focus restoration target', async () => {
    TestBed.overrideProvider(Confirmation, { useFactory: () => new Confirmation() });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    await openCancellation(harness, root);
    const reason = control<HTMLSelectElement>(root, 'select');
    selectValue(reason, 'other');
    const button = control<HTMLButtonElement>(root, '.cancel-quote');
    button.focus();
    button.click();
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    button.click();
    await TestBed.inject(Router).navigateByUrl('/backoffice/affairs');
    expect(TestBed.inject(Router).url).toContain('/summary');
    expect(document.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    control<HTMLButtonElement>(document, '[data-confirmation-cancel]').click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(button);
    expect(cancel).not.toHaveBeenCalled();
  });
  it('keeps an accessible heading and retry action after a load error', async () => {
    get.mockResolvedValueOnce({ success: false, code: 'quote.error' });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('#quote-detail-title')).not.toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    control<HTMLButtonElement>(root, 'button').click();
    await harness.fixture.whenStable();
    expect(get).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('Audit');
  });
  it('does not discard cancellation annotations when a reload confirmation is rejected', async () => {
    cancel.mockResolvedValue({ success: false, code: 'quote.version_conflict' });
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    await openCancellation(harness, root);
    const reason = control<HTMLSelectElement>(root, 'select');
    selectValue(reason, 'other');
    inputValue(root, 'textarea', 'Keep this explanation.');
    control<HTMLButtonElement>(root, '.cancel-quote').click();
    await harness.fixture.whenStable();
    confirm.mockResolvedValue(false);
    control<HTMLButtonElement>(root, '[role="alert"] + button').click();
    await harness.fixture.whenStable();
    expect(get).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(control<HTMLTextAreaElement>(root, 'textarea').value).toBe('Keep this explanation.');
  });
});
