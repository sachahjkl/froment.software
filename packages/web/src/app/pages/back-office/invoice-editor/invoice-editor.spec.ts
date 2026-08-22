import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import type { InvoiceDetailValue } from '@froment/contracts';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoiceEditor } from './invoice-editor';

const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';

const revision = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  version: 1,
  clientDisplayName: 'Acme',
  invoiceNumber: null,
  issuedAt: null,
  title: 'Audit',
  serviceDate: '2026-08-20',
  dueDate: '2026-09-20',
  paymentTerms: '30 days',
  currency: 'EUR' as const,
  netTotalCents: 1_000,
  vatTotalCents: 200,
  totalCents: 1_200,
  createdAt: '2026-08-20T06:00:00.000Z',
  createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAT',
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
};

const detail = (status: InvoiceDetailValue['status'] = 'draft'): InvoiceDetailValue => ({
  id: invoiceId,
  orderId,
  orderReference: 'CO-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status,
  version: 1,
  invoiceNumber: status === 'draft' ? null : 'FA-2026-000001',
  issuedAt: status === 'draft' ? null : '2026-08-20T06:00:00.000Z',
  paidAt: status === 'paid' ? '2026-08-21T06:00:00.000Z' : null,
  voidedAt: status === 'void' ? '2026-08-21T06:00:00.000Z' : null,
  currentRevision: {
    ...revision,
    invoiceNumber: status === 'draft' ? null : 'FA-2026-000001',
    issuedAt: status === 'draft' ? null : '2026-08-20T06:00:00.000Z',
  },
  revisions: [revision],
  pdf: status === 'draft' ? null : { status: 'ready', attempts: 1, error: null },
});

const order = {
  id: orderId,
  reference: 'CO-2026-000001' as const,
  quoteId: '01ARZ3NDEKTSV4RRFFQ69G5FAS',
  quoteReference: 'DE-2026-000001' as const,
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAR',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  clientDisplayName: 'Acme',
  title: 'Audit',
  currency: 'EUR' as const,
  totalCents: 1_200,
  createdAt: '2026-08-20T06:00:00.000Z',
  invoiceId: null,
};

@Component({ template: '' })
class NavigationTarget {}

interface ApiStub {
  get: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  createRevision: ReturnType<typeof vi.fn>;
  issue: ReturnType<typeof vi.fn>;
  markPaid: ReturnType<typeof vi.fn>;
  void: ReturnType<typeof vi.fn>;
  renderPdf: ReturnType<typeof vi.fn>;
}

const input = (element: HTMLInputElement | HTMLSelectElement, value: string): void => {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

const button = (root: HTMLElement, text: RegExp): HTMLButtonElement => {
  const result = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    text.test(candidate.textContent ?? ''),
  );
  if (result === undefined) throw new Error(`Button ${text} is unavailable.`);
  return result;
};

const setup = async (status?: InvoiceDetailValue['status']) => {
  const api: ApiStub = {
    get: vi.fn().mockResolvedValue({ success: true, result: detail(status) }),
    create: vi.fn(),
    createRevision: vi.fn(),
    issue: vi.fn(),
    markPaid: vi.fn(),
    void: vi.fn(),
    renderPdf: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'backoffice/invoices/:invoiceId', component: NavigationTarget }]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap(status === undefined ? {} : { invoiceId }) },
          paramMap: of(convertToParamMap(status === undefined ? {} : { invoiceId })),
        },
      },
      { provide: OrdersApi, useValue: { list: vi.fn().mockResolvedValue([order]) } },
      { provide: InvoicesApi, useValue: api },
    ],
  });
  const fixture = TestBed.createComponent(InvoiceEditor);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return { api, fixture, root };
};

describe('InvoiceEditor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads the PDF preview directly without a sandbox', async () => {
    const { fixture, root } = await setup('draft');
    fixture.detectChanges();
    const frame = await vi.waitFor(() => {
      const result = root.querySelector('iframe');
      if (result === null) throw new Error('The invoice preview frame is unavailable.');
      return result;
    });
    expect(frame.getAttribute('src')).toBe(`/api/invoices/${invoiceId}/revisions/1/preview`);
    expect(frame.hasAttribute('sandbox')).toBe(false);
  });

  it('keeps the newest invoice when route responses finish out of order', async () => {
    type InvoiceOutcome = { readonly success: true; readonly result: InvoiceDetailValue };
    const secondInvoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
    const params = new Subject<ReturnType<typeof convertToParamMap>>();
    let resolveFirst!: (value: InvoiceOutcome) => void;
    let resolveSecond!: (value: InvoiceOutcome) => void;
    const first = new Promise<InvoiceOutcome>((resolve) => (resolveFirst = resolve));
    const second = new Promise<InvoiceOutcome>((resolve) => (resolveSecond = resolve));
    const get = vi.fn((id: string) => (id === invoiceId ? first : second));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ invoiceId }) },
            paramMap: params,
          },
        },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: InvoicesApi, useValue: { get } },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceEditor);
    const root: HTMLElement = fixture.nativeElement;
    await fixture.whenStable();

    params.next(convertToParamMap({ invoiceId }));
    params.next(convertToParamMap({ invoiceId: secondInvoiceId }));
    resolveSecond({
      success: true,
      result: {
        ...detail(),
        id: secondInvoiceId,
        currentRevision: { ...detail().currentRevision, title: 'Newest invoice' },
      },
    });
    await vi.waitFor(() =>
      expect(root.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe(
        'Newest invoice',
      ),
    );
    resolveFirst({ success: true, result: detail() });
    await fixture.whenStable();

    expect(root.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe(
      'Newest invoice',
    );
  });

  it('creates an invoice from an order and replaces the current navigation', async () => {
    const { api, fixture, root } = await setup();
    api.create.mockResolvedValue({ success: true, result: detail() });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(root.querySelector('select')?.textContent).toContain('CO-2026-000001');

    input(root.querySelector('select')!, orderId);
    const dates = root.querySelectorAll<HTMLInputElement>('input[type="date"]');
    input(dates[0]!, '2026-08-20');
    input(dates[1]!, '2026-09-20');
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
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
    expect(button(root, /Enregistrer|Save/).disabled).toBe(false);
  });

  it('creates a revision with the edited public field values', async () => {
    const revised = {
      ...detail(),
      version: 2,
      currentRevision: { ...detail().currentRevision, title: 'Updated audit', version: 2 },
    };
    const { api, fixture, root } = await setup('draft');
    api.createRevision.mockResolvedValue({ success: true, result: revised });

    input(root.querySelector<HTMLInputElement>('input[type="text"]')!, '  Updated audit  ');
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(api.createRevision).toHaveBeenCalledWith(
      invoiceId,
      expect.objectContaining({ expectedVersion: 1, title: 'Updated audit' }),
    );
    expect(root.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('Updated audit');
  });

  it('issues a saved draft and reloads its issued state', async () => {
    const { api, fixture, root } = await setup('draft');
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    api.issue.mockResolvedValue({ success: true, result: { status: 'issued' } });
    api.get.mockResolvedValueOnce({ success: true, result: detail('issued') });

    button(root, /Émettre|Issue/).click();
    await fixture.whenStable();

    expect(api.issue).toHaveBeenCalledWith(invoiceId, 1);
    expect(root.textContent).toMatch(/Émise|Issued/);
    expect(button(root, /payée|paid/).disabled).toBe(false);
  });

  it('disables issuance while the draft contains unsaved changes', async () => {
    const { api, fixture, root } = await setup('draft');

    input(root.querySelector<HTMLInputElement>('input[type="text"]')!, 'Unsaved title');
    await fixture.whenStable();
    button(root, /Émettre|Issue/).click();

    expect(button(root, /Émettre|Issue/).disabled).toBe(true);
    expect(api.issue).not.toHaveBeenCalled();
  });

  it('disables revision saving after issuance', async () => {
    const { root } = await setup('issued');

    expect(button(root, /Enregistrer|Save/).disabled).toBe(true);
  });

  it.each([
    ['paid', /payée|paid/i, 'markPaid'],
    ['void', /Annuler la facture|Void invoice/i, 'void'],
  ] as const)('transitions an issued invoice to %s', async (status, label, method) => {
    const { api, fixture, root } = await setup('issued');
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    api[method].mockResolvedValue({ success: true, result: detail(status) });

    button(root, label).click();
    await fixture.whenStable();

    expect(api[method]).toHaveBeenCalledWith(invoiceId, { expectedVersion: 1 });
    expect(root.textContent).toMatch(status === 'paid' ? /Payée|Paid/ : /Annulée|Void/);
  });

  it('generates a revision PDF and exposes its download URL', async () => {
    const { api, fixture, root } = await setup('draft');
    api.renderPdf.mockResolvedValue({ success: true, result: {} });

    button(root, /Générer|Generate/).click();
    await fixture.whenStable();

    expect(api.renderPdf).toHaveBeenCalledWith(invoiceId, 1);
    expect(
      root.querySelector<HTMLAnchorElement>(`a[href="/api/invoices/${invoiceId}/revisions/1/pdf"]`),
    ).not.toBeNull();
  });

  it('shows a version conflict and restores saving', async () => {
    const { api, fixture, root } = await setup('draft');
    api.createRevision.mockResolvedValue({ success: false, code: 'invoice.version_conflict' });
    input(root.querySelector<HTMLInputElement>('input[type="text"]')!, 'Updated');

    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(
      /changed elsewhere|version|révision/i,
    );
    expect(button(root, /Enregistrer|Save/).disabled).toBe(false);
  });

  it('restores saving after a revision network error', async () => {
    const { api, fixture, root } = await setup('draft');
    api.createRevision.mockRejectedValue(new Error('offline'));
    input(root.querySelector<HTMLInputElement>('input[type="text"]')!, 'Updated');

    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/facture|invoice/i);
    expect(button(root, /Enregistrer|Save/).disabled).toBe(false);
  });

  it('restores action pending after a transition network error', async () => {
    const { api, fixture, root } = await setup('issued');
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    api.markPaid.mockRejectedValue(new Error('offline'));

    button(root, /payée|paid/i).click();
    await fixture.whenStable();

    expect(button(root, /payée|paid/i).disabled).toBe(false);
    expect(button(root, /Annuler la facture|Void invoice/i).disabled).toBe(false);
  });

  it('restores PDF pending after a network error', async () => {
    const { api, fixture, root } = await setup('draft');
    api.renderPdf.mockRejectedValue(new Error('offline'));

    button(root, /Générer|Generate/).click();
    await fixture.whenStable();

    expect(button(root, /Générer|Generate/).disabled).toBe(false);
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/facture|invoice/i);
  });

  it('marks invalid dates and lines, describes local errors, and focuses the first field', async () => {
    const { api, fixture, root } = await setup('draft');
    const dates = root.querySelectorAll<HTMLInputElement>('input[type="date"]');
    const lineInputs = root.querySelectorAll<HTMLInputElement>('fieldset input');
    input(dates[0]!, '2026-10-20');
    input(dates[1]!, '2026-09-20');
    input(lineInputs[0]!, ' ');
    input(lineInputs[1]!, '0');

    const save = button(root, /Enregistrer|Save/);
    expect(save.disabled).toBe(false);
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true }));
    await fixture.whenStable();

    expect(api.createRevision).not.toHaveBeenCalled();
    expect(dates[1]!.getAttribute('aria-invalid')).toBe('true');
    expect(dates[1]!.getAttribute('aria-describedby')).toBe('invoice-due-date-error');
    expect(root.querySelector('#invoice-due-date-error')).not.toBeNull();
    expect(lineInputs[0]!.getAttribute('aria-describedby')).toBe(
      'invoice-line-description-error-0',
    );
    expect(root.querySelector('#invoice-line-description-error-0')).not.toBeNull();
    expect(lineInputs[1]!.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(dates[1]);
  });

  it('rejects an invalid invoice identifier', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ invoiceId: 'invalid' }) },
            paramMap: of(convertToParamMap({ invoiceId: 'invalid' })),
          },
        },
        { provide: OrdersApi, useValue: {} },
        { provide: InvoicesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceEditor);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /introuvable|not found/,
    );
  });
});
