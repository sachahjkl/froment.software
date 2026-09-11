import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { QuotesApi } from '@backoffice/quotes-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { TextCopy } from '@shared/text-copy';
import {
  artifactFixture,
  commercialTestRoutes,
  control,
  quoteFixture,
  quoteId,
} from '../quote-detail/commercial.spec-helper';

describe('Quote publication', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  const get = vi.fn();
  const renderPdf = vi.fn();
  const send = vi.fn();
  const linkState = vi.fn();
  const replaceLink = vi.fn();
  const copy = vi.fn();
  const confirm = vi.fn();
  const sent = {
    quoteId,
    revisionId: quoteFixture.currentRevision.id,
    version: 2,
    status: 'sent',
    link: {
      id: 'link',
      url: 'https://froment.software/quote#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      expiresAt: '2026-09-19T06:00:00.000Z',
    },
  };
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ success: true, result: quoteFixture });
    renderPdf.mockReset().mockResolvedValue({ success: true, result: artifactFixture });
    send.mockReset().mockResolvedValue({ success: true, result: sent });
    linkState.mockReset().mockResolvedValue({
      success: true,
      result: { id: sent.link.id, expiresAt: sent.link.expiresAt },
    });
    replaceLink.mockReset().mockResolvedValue({ success: true, result: sent });
    copy.mockReset().mockResolvedValue(true);
    confirm.mockReset().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(commercialTestRoutes),
        { provide: QuotesApi, useValue: { get, renderPdf, send, linkState, replaceLink } },
        { provide: TextCopy, useValue: { copy } },
        { provide: Confirmation, useValue: { request: confirm } },
      ],
    });
  });
  async function open() {
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}/publication`);
    await harness.fixture.whenStable();
    return { harness, root: harness.fixture.nativeElement as HTMLElement };
  }
  async function prepare(harness: RouterTestingHarness, root: HTMLElement) {
    control<HTMLButtonElement>(root, 'app-quote-document button').click();
    await harness.fixture.whenStable();
    control<HTMLInputElement>(root, 'input[type="checkbox"]').click();
    await harness.fixture.whenStable();
  }
  it('requires the exact revision PDF and a review confirmation', async () => {
    const { harness, root } = await open();
    expect(control<HTMLIFrameElement>(root, 'iframe').getAttribute('src')).toBe(
      `/api/quotes/${quoteId}/revisions/2/preview`,
    );
    expect(root.querySelector('iframe')?.hasAttribute('sandbox')).toBe(false);
    const publish = control<HTMLButtonElement>(root, 'button[type="submit"]');
    expect(publish.disabled).toBe(false);
    publish.click();
    await harness.fixture.whenStable();
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector('app-quote-document button'));
    control<HTMLButtonElement>(root, 'app-quote-document button').click();
    await harness.fixture.whenStable();
    expect(renderPdf).toHaveBeenCalledWith(quoteId, 2);
    publish.click();
    await harness.fixture.whenStable();
    expect(send).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector('input[type="checkbox"]'));
  });
  it('publishes once without claiming that an email was sent', async () => {
    const { harness, root } = await open();
    await prepare(harness, root);
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(send).toHaveBeenCalledExactlyOnceWith(quoteId, { expectedVersion: 2 });
    expect(root.textContent).toMatch(/aucun courriel|does not send an email/);
    expect(root.querySelector('button[type="submit"]')).toBeNull();
    expect(control<HTMLAnchorElement>(root, 'app-copy-field a').href).toBe(sent.link.url);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(TestBed.inject(Router).url).toContain('/publication');
    control<HTMLButtonElement>(root, 'app-copy-field button').click();
    await harness.fixture.whenStable();
    expect(copy).toHaveBeenCalledWith(sent.link.url);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(TestBed.inject(Router).url).toBe('/backoffice/affaires');
  });
  it('shows server blockers and retains the reviewed revision', async () => {
    send.mockResolvedValue({
      success: false,
      code: 'document.incomplete',
      failure: {
        _tag: 'DocumentIncomplete',
        issues: [{ party: 'issuer', field: 'email', reason: 'required' }],
      },
    });
    const { harness, root } = await open();
    await prepare(harness, root);
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('app-document-issues')).not.toBeNull();
    expect(root.querySelector('a[href="/backoffice/configuration/entreprise"]')).not.toBeNull();
    expect(control<HTMLInputElement>(root, 'input[type="checkbox"]').checked).toBe(true);
  });
  it('does not retry an uncertain publication or invent a recovered link', async () => {
    send.mockResolvedValue({ success: false, code: 'quote.error' });
    const { harness, root } = await open();
    await prepare(harness, root);
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(control<HTMLButtonElement>(root, 'button[type="submit"]').disabled).toBe(true);
    expect(root.querySelector('app-copy-field')).toBeNull();
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'sent' } });
    control<HTMLButtonElement>(root, 'form button[type="button"]').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toMatch(/remplacez|replace/);
    expect(send).toHaveBeenCalledOnce();
    expect(replaceLink).not.toHaveBeenCalled();
  });
  it('retains version conflicts instead of publishing a newer revision', async () => {
    send.mockResolvedValue({ success: false, code: 'quote.version_conflict' });
    const { harness, root } = await open();
    await prepare(harness, root);
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(get).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(quoteId, { expectedVersion: 2 });
  });

  it('replaces a lost link only after confirmation against the loaded link identifier', async () => {
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'sent' } });
    const { harness, root } = await open();
    const replace = control<HTMLButtonElement>(root, '.spacer-x-3 button');
    replace.click();
    await harness.fixture.whenStable();
    expect(replaceLink).not.toHaveBeenCalled();
    confirm.mockResolvedValue(true);
    replace.click();
    await harness.fixture.whenStable();
    expect(replaceLink).toHaveBeenCalledExactlyOnceWith(quoteId, {
      expectedVersion: quoteFixture.version,
      expectedLinkId: sent.link.id,
    });
    expect(send).not.toHaveBeenCalled();
    expect(control<HTMLAnchorElement>(root, 'app-copy-field a').href).toBe(sent.link.url);
  });

  it('blocks another replacement until an uncertain result has been checked', async () => {
    get.mockResolvedValue({ success: true, result: { ...quoteFixture, status: 'sent' } });
    replaceLink.mockResolvedValue({ success: false, code: 'quote.error' });
    confirm.mockResolvedValue(true);
    const { harness, root } = await open();
    control<HTMLButtonElement>(root, '.spacer-x-3 button').click();
    await harness.fixture.whenStable();
    const replace = control<HTMLButtonElement>(root, '.spacer-x-3 button');
    expect(replace.disabled).toBe(true);
    replace.click();
    await harness.fixture.whenStable();
    expect(replaceLink).toHaveBeenCalledOnce();
    expect(root.querySelector('app-copy-field')).toBeNull();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it('warns before leaving a reviewed checkbox, including a cleared checkbox', async () => {
    const { harness, root } = await open();
    const checkbox = control<HTMLInputElement>(root, 'input[type="checkbox"]');
    checkbox.click();
    checkbox.click();
    checkbox.dispatchEvent(new Event('blur'));
    await harness.fixture.whenStable();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(confirm).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toContain('/publication');
  });
  it('keeps uncertain exit protection through failed and pending status reloads', async () => {
    send.mockResolvedValue({ success: false, code: 'quote.error' });
    const { harness, root } = await open();
    await prepare(harness, root);
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(confirm).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toContain('/publication');
    get.mockResolvedValueOnce({ success: false, code: 'quote.error' });
    control<HTMLButtonElement>(root, 'form button[type="button"]').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    let resolve!: (value: { success: true; result: typeof quoteFixture }) => void;
    const loading = new Promise<{ success: true; result: typeof quoteFixture }>((done) => {
      resolve = done;
    });
    get.mockReturnValueOnce(loading);
    control<HTMLButtonElement>(root, 'button').click();
    try {
      await vi.waitFor(() => expect(root.querySelector('[role="status"]')).not.toBeNull());
      expect(harness.fixture.isStable()).toBe(false);
      expect(root.querySelector('form')).toBeNull();
      const pendingEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(pendingEvent);
      expect(pendingEvent.defaultPrevented).toBe(true);
    } finally {
      resolve({ success: true, result: quoteFixture });
    }
    await harness.fixture.whenStable();
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(send).toHaveBeenCalledOnce();
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/PDF/);
  });
});
import { provideAccount } from '@backoffice/account.spec-helper';
