import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicQuoteApi } from '../../public-quote/public-quote-api';
import { publicQuoteContextChanged } from '../../public-quote/public-quote-navigation';
import { PublicQuote } from './public-quote';
import { I18nService } from '@app/i18n.service';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';
import { Confirmation } from '@shared/confirmation/confirmation';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';

@Component({ template: '' })
class OutsidePage {}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const quote = {
  status: 'sent' as const,
  canSign: true,
  expiresAt: '2026-09-19T06:00:00.000Z',
  snapshot: {
    templateId: 'quote-default' as const,
    templateVersion: 1 as const,
    quoteReference: 'DE-2026-000001' as const,
    quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    version: 1,
    createdAt: '2026-08-20T06:00:00.000Z',
    issuer: {
      displayName: 'Froment Software',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
      phone: '',
      registrationNumber: '',
      vatNumber: '',
    },
    client: {
      displayName: 'Ada Lovelace',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
      phone: '',
    },
    title: 'Software audit',
    conditions: 'Payable in 30 days',
    currency: 'EUR' as const,
    netTotalCents: 10_000,
    vatTotalCents: 2_000,
    totalCents: 12_000,
    lines: [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        position: 0,
        description: 'Software audit',
        quantityMilli: 1_000,
        unitPriceCents: 10_000,
        vatRateBasisPoints: 2_000,
        netTotalCents: 10_000,
        vatTotalCents: 2_000,
        totalCents: 12_000,
      },
    ],
  },
};

describe('PublicQuote', () => {
  const get = vi.fn().mockResolvedValue({ success: true, result: quote });
  const getPdf = vi.fn().mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
  const sign = vi.fn().mockResolvedValue({
    success: true,
    result: {
      quoteId: quote.snapshot.quoteId,
      revisionId: quote.snapshot.revisionId,
      signatureId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
      quoteReference: 'DE-2026-000001',
      orderReference: 'CO-2026-000001',
      status: 'accepted',
      acceptedAt: '2026-08-20T06:30:00.000Z',
      evidenceSha256: 'a'.repeat(64),
    },
  });
  const confirmation = { request: vi.fn().mockResolvedValue(false) };

  beforeEach(() => {
    get.mockClear();
    getPdf.mockClear();
    sign.mockClear();
    confirmation.request.mockReset().mockResolvedValue(false);
    globalThis.location.hash = token;
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn().mockReturnValue('blob:quote-pdf'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: PublicQuote,
            canDeactivate: [unsavedChangesGuard],
            runGuardsAndResolvers: publicQuoteContextChanged,
            children: [
              { path: 'summary', component: TabPanelOutlet, data: { panel: 'summary' } },
              { path: 'document', component: TabPanelOutlet, data: { panel: 'document' } },
              { path: 'signature', component: TabPanelOutlet, data: { panel: 'signature' } },
              { path: 'confirmation', component: TabPanelOutlet, data: { panel: 'confirmation' } },
            ],
          },
          { path: 'outside', component: OutsidePage },
        ]),
        { provide: PublicQuoteApi, useValue: { get, getPdf, sign } },
        { provide: Confirmation, useValue: confirmation },
      ],
    });
  });

  afterEach(() => {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
  });

  describe('decoded public access', () => {
    async function consult(body: Parameters<TestRequest['flush']>[0], status = 200) {
      TestBed.configureTestingModule({
        providers: [provideHttpClient(), provideHttpClientTesting()],
      });
      TestBed.overrideProvider(PublicQuoteApi, { useFactory: () => new PublicQuoteApi() });
      const api = TestBed.inject(PublicQuoteApi);
      const download = vi
        .spyOn(api, 'getPdf')
        .mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }));
      const signature = vi.spyOn(api, 'sign');
      const http = TestBed.inject(HttpTestingController);
      const harness = await RouterTestingHarness.create(`/signature#${token}`);
      const request = http.expectOne('/api/public/quote-link');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ token });
      request.flush(body, { status, statusText: status === 200 ? 'OK' : 'Not Found' });
      await harness.fixture.whenStable();
      return { harness, root: harness.routeNativeElement!, download, signature, http };
    }

    it.each(['sent', 'accepted'] as const)(
      'blocks signature for a decoded %s quote with canSign false',
      async (status) => {
        const { root, harness, download, signature, http } = await consult({
          ...quote,
          status,
          canSign: false,
        });
        const i18n = TestBed.inject(I18nService);
        await vi.waitFor(() =>
          expect(root.querySelector('#quote-signature-panel [role="status"]')).not.toBeNull(),
        );
        expect(root.querySelector('#quote-signature-panel [role="status"]')?.textContent).toContain(
          i18n.t(
            status === 'accepted'
              ? 'publicQuote.alreadyAccepted'
              : 'publicQuoteWorkspace.notSignable',
          ),
        );
        expect(root.querySelector('form, input, button[type="submit"]')).toBeNull();
        expect(root.querySelector('[role="alert"]')).toBeNull();
        expect(download).toHaveBeenCalledExactlyOnceWith(token);
        root.querySelector<HTMLAnchorElement>('#quote-document-tab')!.click();
        await harness.fixture.whenStable();
        expect(root.querySelector('#quote-document-panel a[download]')).not.toBeNull();
        expect(root.querySelector('#quote-document-panel a[appLinkButton]')).toBeNull();
        expect(signature).not.toHaveBeenCalled();
        http.expectNone('/api/public/quote-link/signature');
        http.verify();
      },
    );

    it('renders the unavailable response used for expired and cancelled links without a PDF or signature', async () => {
      const { root, download, signature, http } = await consult(
        { _tag: 'QuoteLinkNotFound', code: 'quote_link.not_found' },
        404,
      );
      await vi.waitFor(() =>
        expect(root.querySelector('.state-card[role="alert"]')).not.toBeNull(),
      );
      expect(root.querySelector('[role="alert"]')?.textContent).toContain(
        TestBed.inject(I18nService).t('quote_link.not_found'),
      );
      expect(
        root.querySelector('form, input, app-tabs, #quote-signature-panel, iframe, a[download]'),
      ).toBeNull();
      expect(download).not.toHaveBeenCalled();
      expect(signature).not.toHaveBeenCalled();
      http.expectNone('/api/public/quote-link/signature');
      http.verify();
    });

    it.each(['expired', 'cancelled'])(
      'rejects a successful response with the unsupported public status %s',
      async (status) => {
        const { root, download, signature, http } = await consult({
          ...quote,
          status,
          canSign: false,
        });
        await vi.waitFor(() =>
          expect(root.querySelector('.state-card[role="alert"]')).not.toBeNull(),
        );
        expect(root.querySelector('[role="alert"]')?.textContent).toContain(
          TestBed.inject(I18nService).t('publicQuote.error'),
        );
        expect(root.querySelector('form, input, app-tabs, #quote-signature-panel')).toBeNull();
        expect(download).not.toHaveBeenCalled();
        expect(signature).not.toHaveBeenCalled();
        http.verify();
      },
    );
  });

  it('keeps the permalink and presents the immutable quote', async () => {
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    const fixture = harness.fixture;
    const root: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => expect(root.textContent).toContain('Software audit'));

    expect(get).toHaveBeenCalledWith(token);
    expect(getPdf).toHaveBeenCalledWith(token);
    expect(globalThis.location.hash).toBe(`#${token}`);
    expect(root.textContent).toContain('Software audit');
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.querySelectorAll('app-tabs a')).toHaveLength(4);
    expect(root.querySelector('#quote-signature-panel')).toBeNull();
    root.querySelector<HTMLAnchorElement>('#quote-document-tab')?.click();
    await fixture.whenStable();
    expect(root.querySelector('a[download]')?.getAttribute('download')).toBe('DE-2026-000001.pdf');
    expect(root.querySelector('iframe')?.getAttribute('src')).toBe('blob:quote-pdf');
  });

  it('submits explicit consent and shows the accepted state', async () => {
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    const fixture = harness.fixture;
    const root: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => expect(root.textContent).toContain('Software audit'));
    root.querySelector<HTMLAnchorElement>('#quote-signature-tab')?.click();
    await fixture.whenStable();
    const inputs = root.querySelectorAll<HTMLInputElement>('input[type="text"]');
    if (inputs[0] !== undefined) inputs[0].value = 'Ada Lovelace';
    inputs[0]?.dispatchEvent(new Event('input'));
    if (inputs[1] !== undefined) inputs[1].value = 'Ada Lovelace';
    inputs[1]?.dispatchEvent(new Event('input'));
    const consent = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (consent === null) throw new Error('The consent field is unavailable.');
    consent.checked = true;
    consent.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(sign).toHaveBeenCalledWith({
      token,
      signerName: 'Ada Lovelace',
      consent: true,
      signature: { kind: 'typed', value: 'Ada Lovelace' },
    });
    expect(root.textContent).toMatch(/accepté|accepted/i);
    expect(root.querySelector('#quote-confirmation-panel')).not.toBeNull();
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('CO-2026-000001');
  });

  it('preserves the personal fragment between consultation steps', async () => {
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    await harness.fixture.whenStable();
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('#quote-document-tab')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/document#${token}`);
    expect(get).toHaveBeenCalledOnce();
    expect(getPdf).toHaveBeenCalledOnce();
  });

  it('preserves an unfinished signature between steps but guards a token change', async () => {
    const otherToken = 'B'.repeat(43);
    const harness = await RouterTestingHarness.create(`/signature#${token}`);
    const page = await harness.navigateByUrl(`/signature#${token}`, PublicQuote);
    page['signatureForm'].signerName().value.set('Ada');
    page['signatureForm']().markAsDirty();

    await harness.navigateByUrl(`/document#${token}`);
    expect(page['signatureModel']().signerName).toBe('Ada');
    expect(get).toHaveBeenCalledOnce();
    expect(confirmation.request).not.toHaveBeenCalled();

    await harness.navigateByUrl(`/signature#${otherToken}`);
    expect(TestBed.inject(Router).url).toBe(`/document#${token}`);
    expect(page['signatureModel']().signerName).toBe('Ada');
    expect(confirmation.request).toHaveBeenCalledOnce();

    confirmation.request.mockResolvedValueOnce(true);
    await harness.navigateByUrl(`/signature#${otherToken}`);
    await harness.fixture.whenStable();
    expect(get).toHaveBeenLastCalledWith(otherToken);
    expect(page['signatureModel']()).toEqual({ signerName: '', signature: '', consent: false });
    expect(page['signatureForm']().dirty()).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:quote-pdf');

    page['signatureModel'].set({ signerName: 'Ada', signature: 'Ada', consent: true });
    page['sign'](new SubmitEvent('submit'));
    await harness.fixture.whenStable();
    expect(sign).toHaveBeenLastCalledWith(expect.objectContaining({ token: otherToken }));
    expect(TestBed.inject(Router).url).toBe(`/confirmation#${otherToken}`);
  });

  it('ignores an obsolete consultation response after the token changes', async () => {
    const first = deferred<{ success: true; result: typeof quote }>();
    get.mockReturnValueOnce(first.promise);
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    const otherToken = 'B'.repeat(43);
    const page = await harness.navigateByUrl(`/summary#${otherToken}`, PublicQuote);
    await harness.fixture.whenStable();
    first.resolve({ success: true, result: { ...quote, canSign: false } });
    await first.promise;
    await harness.fixture.whenStable();

    expect(page['quote']()?.canSign).toBe(true);
    expect(getPdf).toHaveBeenCalledExactlyOnceWith(otherToken);
    expect(page['loading']()).toBe(false);
  });

  it('ignores an obsolete PDF failure without completing the new consultation', async () => {
    const firstPdf = deferred<Blob>();
    const secondQuote = deferred<{ success: true; result: typeof quote }>();
    getPdf.mockReturnValueOnce(firstPdf.promise);
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    get.mockReturnValueOnce(secondQuote.promise);
    const page = await harness.navigateByUrl(`/summary#${'B'.repeat(43)}`, PublicQuote);
    firstPdf.reject(new Error('obsolete_pdf'));
    await harness.fixture.whenStable();

    expect(page['loading']()).toBe(true);
    expect(page['error']()).toBeUndefined();
    expect(page['pdfUrl']()).toBeUndefined();
    secondQuote.resolve({ success: true, result: quote });
    await secondQuote.promise;
    await harness.fixture.whenStable();
    expect(page['loading']()).toBe(false);
  });

  it('clears the previous consultation when the next token is invalid', async () => {
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    const page = await harness.navigateByUrl('/summary#invalid', PublicQuote);
    await harness.fixture.whenStable();

    expect(page['quote']()).toBeUndefined();
    expect(page['pdfUrl']()).toBeUndefined();
    expect(page['error']()).toBe('quote_link.not_found');
    expect(page['loading']()).toBe(false);
    expect(get).toHaveBeenCalledOnce();
  });

  it('blocks token changes while a signature is pending', async () => {
    const pending = deferred<Awaited<ReturnType<PublicQuoteApi['sign']>>>();
    sign.mockReturnValueOnce(pending.promise);
    const harness = await RouterTestingHarness.create(`/signature#${token}`);
    const page = await harness.navigateByUrl(`/signature#${token}`, PublicQuote);
    page['signatureModel'].set({ signerName: 'Ada', signature: 'Ada', consent: true });
    page['sign'](new SubmitEvent('submit'));
    await harness.fixture.whenStable();

    await harness.navigateByUrl(`/signature#${'B'.repeat(43)}`);
    expect(TestBed.inject(Router).url).toBe(`/signature#${token}`);
    expect(get).toHaveBeenCalledOnce();
    expect(confirmation.request).not.toHaveBeenCalled();
    pending.resolve({ success: false, code: 'publicQuote.error' });
    await pending.promise;
    await harness.fixture.whenStable();
    expect(page['signing']()).toBe(false);
  });

  it('uses one main landmark, translates its summary, and describes invalid fields', async () => {
    TestBed.inject(I18nService).setLanguage('en');
    const harness = await RouterTestingHarness.create(`/summary#${token}`);
    const fixture = harness.fixture;
    const root: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => expect(root.textContent).toContain('Software audit'));
    root.querySelector<HTMLAnchorElement>('#quote-signature-tab')?.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#public-quote-signer-name')!;

    name.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(root.querySelector('main')).toBeNull();
    expect(root.querySelector('.quote-facts')?.getAttribute('aria-label')).toBe('Quote summary');
    expect(root.querySelector('#quote-signature-tab')?.getAttribute('aria-current')).toBe('page');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('public-quote-signer-name-error');
    expect(root.querySelector('#public-quote-signer-name-error')).not.toBeNull();
  });

  it('focuses invalid fields and protects an unfinished signature when leaving', async () => {
    const harness = await RouterTestingHarness.create(`/signature#${token}`);
    const fixture = harness.fixture;
    const root = harness.routeNativeElement!;
    await fixture.whenStable();
    const button = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('public-quote-signer-name');
    expect(sign).not.toHaveBeenCalled();
    const name = root.querySelector<HTMLInputElement>('#public-quote-signer-name')!;
    name.value = 'Ada';
    name.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await harness.navigateByUrl('/outside');
    expect(confirmation.request).toHaveBeenCalledOnce();
    expect(root.querySelector('form')).not.toBeNull();
  });
});
