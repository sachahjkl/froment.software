import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicQuoteApi } from '../../public-quote/public-quote-api';
import { PublicQuote } from './public-quote';
import { I18nService } from '@app/i18n.service';

const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const quote = {
  status: 'sent' as const,
  canSign: true,
  expiresAt: '2026-09-19T06:00:00.000Z',
  snapshot: {
    templateId: 'quote-default' as const,
    templateVersion: 1 as const,
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
    },
    title: 'Software audit',
    conditions: 'Payable in 30 days',
    currency: 'EUR' as const,
    netTotalCents: 10_000,
    vatTotalCents: 2_000,
    totalCents: 12_000,
    lines: [],
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
      status: 'accepted',
      acceptedAt: '2026-08-20T06:30:00.000Z',
      evidenceSha256: 'a'.repeat(64),
    },
  });

  beforeEach(() => {
    get.mockClear();
    getPdf.mockClear();
    sign.mockClear();
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
      providers: [{ provide: PublicQuoteApi, useValue: { get, getPdf, sign } }],
    });
  });

  afterEach(() => {
    globalThis.history.replaceState(null, '', globalThis.location.pathname);
  });

  it('removes the token and presents the immutable quote', async () => {
    const fixture = TestBed.createComponent(PublicQuote);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(get).toHaveBeenCalledWith(token);
    expect(getPdf).toHaveBeenCalledWith(token);
    expect(globalThis.location.hash).toBe('');
    expect(root.textContent).toContain('Software audit');
    expect(root.innerHTML).not.toContain(token);
    expect(root.querySelector('iframe')?.getAttribute('src')).toBe('blob:quote-pdf');
  });

  it('submits explicit consent and shows the accepted state', async () => {
    const fixture = TestBed.createComponent(PublicQuote);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
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
  });

  it('uses one main landmark, translates its summary, and describes invalid fields', async () => {
    TestBed.inject(I18nService).setLanguage('en');
    const fixture = TestBed.createComponent(PublicQuote);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector<HTMLInputElement>('#public-quote-signer-name')!;

    name.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(root.querySelector('main')).toBeNull();
    expect(root.querySelector('.quote-facts')?.getAttribute('aria-label')).toBe('Quote summary');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('public-quote-signer-name-error');
    expect(root.querySelector('#public-quote-signer-name-error')).not.toBeNull();
  });
});
