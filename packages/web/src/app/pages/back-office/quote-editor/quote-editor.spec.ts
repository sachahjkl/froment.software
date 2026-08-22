import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { of, Subject } from 'rxjs';

import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { TextCopy } from '@shared/text-copy';
import { QuoteEditor } from './quote-editor';

const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const revisionId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
const quoteDetail = {
  id: quoteId,
  reference: 'DE-2026-000001' as const,
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'draft' as const,
  version: 2,
  currentRevision: {
    id: revisionId,
    version: 2,
    clientDisplayName: 'Acme',
    title: 'Audit',
    conditions: '',
    currency: 'EUR' as const,
    netTotalCents: 1_000,
    vatTotalCents: 200,
    totalCents: 1_200,
    createdAt: '2026-08-20T06:00:00.000Z',
    createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    lines: [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        position: 0,
        description: 'Audit',
        quantityMilli: 1_000,
        unitPriceCents: 1_000,
        vatRateBasisPoints: 2_000,
        netTotalCents: 1_000,
        vatTotalCents: 200,
        totalCents: 1_200,
      },
    ],
  },
  revisions: [],
};

describe('QuoteEditor', () => {
  it('replaces and revokes PDF preview object URLs', async () => {
    const createObjectUrl = vi
      .fn()
      .mockReturnValueOnce('blob:quote-first')
      .mockReturnValueOnce('blob:quote-second');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const preview = vi.fn().mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ quoteId }) },
            paramMap: of(convertToParamMap({ quoteId })),
          },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: QuoteConditionPresetsApi, useValue: { list: () => Promise.resolve([]) } },
        {
          provide: QuotesApi,
          useValue: {
            preview,
            get: () =>
              Promise.resolve({
                success: true,
                result: {
                  ...quoteDetail,
                  revisions: [{ ...quoteDetail.currentRevision, previewAvailable: true }],
                },
              }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    await vi.waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(root.querySelector('iframe')).not.toBeNull());
    const previewButton = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => /Aperçu|Preview/.test(candidate.textContent ?? ''),
    );
    if (previewButton === undefined) throw new Error('The preview button is unavailable.');

    previewButton.click();
    await vi.waitFor(() => expect(preview).toHaveBeenCalledTimes(2));
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:quote-first');

    fixture.destroy();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:quote-second');
  });

  it('keeps the newest quote when route responses finish out of order', async () => {
    type QuoteOutcome = { readonly success: true; readonly result: typeof quoteDetail };
    const secondQuoteId = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
    const params = new Subject<ReturnType<typeof convertToParamMap>>();
    let resolveFirst!: (value: QuoteOutcome) => void;
    let resolveSecond!: (value: QuoteOutcome) => void;
    const first = new Promise<QuoteOutcome>((resolve) => (resolveFirst = resolve));
    const second = new Promise<QuoteOutcome>((resolve) => (resolveSecond = resolve));
    const get = vi.fn((id: string) => (id === quoteId ? first : second));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ quoteId }) },
            paramMap: params,
          },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: QuoteConditionPresetsApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: QuotesApi, useValue: { get } },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    const root: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    params.next(convertToParamMap({ quoteId }));
    params.next(convertToParamMap({ quoteId: secondQuoteId }));
    resolveSecond({
      success: true,
      result: {
        ...quoteDetail,
        id: secondQuoteId,
        currentRevision: { ...quoteDetail.currentRevision, title: 'Newest quote' },
      },
    });
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLInputElement>('#quote-name')?.value).toBe('Newest quote'),
    );
    resolveFirst({ success: true, result: quoteDetail });
    await fixture.whenStable();

    expect(root.querySelector<HTMLInputElement>('#quote-name')?.value).toBe('Newest quote');
  });

  it('adds a quote line without calculating totals in the browser', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        {
          provide: QuoteConditionPresetsApi,
          useValue: {
            list: () =>
              Promise.resolve([
                {
                  id: '01ARZ3NDEKTSV4RRFFQ69G5FAS',
                  name: 'Standard payment',
                  conditions: 'Payment is due within 30 days.',
                },
              ]),
          },
        },
        { provide: QuotesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const before = root.querySelectorAll('fieldset').length;
    const addButton = root.querySelector<HTMLButtonElement>('.section-heading button');
    if (addButton === null)
      throw new Error(`The add line button is unavailable: ${root.textContent}`);

    addButton.click();
    fixture.detectChanges();

    expect(before).toBe(1);
    expect(root.querySelectorAll('fieldset')).toHaveLength(2);
    expect(root.textContent).not.toContain('Total HT');

    const presetSelect = root.querySelector<HTMLSelectElement>('.condition-preset select');
    const conditions = root.querySelector<HTMLTextAreaElement>('textarea');
    if (presetSelect === null || conditions === null) {
      throw new Error('The preset conditions controls are unavailable.');
    }
    presetSelect.value = '01ARZ3NDEKTSV4RRFFQ69G5FAS';
    presetSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(conditions.value).toBe('Payment is due within 30 days.');
    expect(presetSelect.value).toBe('');
  });

  it('does not turn an invalid quote URL into a creation form', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ quoteId: 'invalid' }) },
            paramMap: of(convertToParamMap({ quoteId: 'invalid' })),
          },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        {
          provide: QuoteConditionPresetsApi,
          useValue: { list: () => Promise.resolve([]) },
        },
        { provide: QuotesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/introuvable|not found/);
  });

  it('explains an invalid quantity on its line', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        {
          provide: QuoteConditionPresetsApi,
          useValue: { list: () => Promise.resolve([]) },
        },
        { provide: QuotesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const quantity = root.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
    if (quantity === null) throw new Error('The quantity input is unavailable.');

    quantity.value = '0';
    quantity.dispatchEvent(new Event('input'));
    quantity.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(root.textContent).toMatch(/quantité positive|positive quantity/);
  });

  it('sends a saved draft, displays its permalink, and disables editing', async () => {
    const linkUrl = 'https://froment.software/quote#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const copy = vi.fn().mockResolvedValue(true);
    const send = vi.fn().mockResolvedValue({
      success: true,
      result: {
        quoteId,
        revisionId,
        status: 'sent',
        version: 2,
        link: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAT',
          url: linkUrl,
          expiresAt: '2026-09-19T06:00:00.000Z',
        },
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ quoteId }) },
            paramMap: of(convertToParamMap({ quoteId })),
          },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
        {
          provide: QuoteConditionPresetsApi,
          useValue: { list: () => Promise.resolve([]) },
        },
        { provide: TextCopy, useValue: { copy } },
        {
          provide: QuotesApi,
          useValue: { get: () => Promise.resolve({ success: true, result: quoteDetail }), send },
        },
      ],
    });
    const fixture = TestBed.createComponent(QuoteEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    });
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const sendButton = root.querySelector<HTMLButtonElement>('.send-quote');
    if (sendButton === null) throw new Error('The send button is unavailable.');

    sendButton.click();
    await fixture.whenStable();

    expect(send).toHaveBeenCalledWith(quoteId, { expectedVersion: 2 });
    expect(root.querySelector<HTMLAnchorElement>('.sent-link a')?.href).toContain('/quote#');
    expect(root.textContent).toMatch(/Envoyé|Sent/);
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.querySelector<HTMLInputElement>('#quote-name')?.disabled).toBe(true);
    expect(root.querySelector('.send-quote')).toBeNull();

    root.querySelector<HTMLButtonElement>('.sent-link button')?.click();
    await fixture.whenStable();
    expect(copy).toHaveBeenCalledWith(linkUrl);
    expect(root.querySelector('app-copy-field [role="status"]')?.textContent).toMatch(
      /copié|copied/i,
    );
  });
});
