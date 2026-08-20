import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoiceEditor } from './invoice-editor';

const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const detail = {
  id: invoiceId,
  orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'draft' as const,
  version: 1,
  invoiceNumber: null,
  issuedAt: null,
  paidAt: null,
  voidedAt: null,
  currentRevision: {
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
  },
  revisions: [],
};

describe('InvoiceEditor', () => {
  it('does not issue a dirty draft', async () => {
    const issue = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ invoiceId }) } },
        },
        { provide: OrdersApi, useValue: {} },
        {
          provide: InvoicesApi,
          useValue: { get: () => Promise.resolve({ success: true, result: detail }), issue },
        },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceEditor);
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.actions button')).not.toBeNull();
    });
    const root: HTMLElement = fixture.nativeElement;
    const title = root.querySelector<HTMLInputElement>('input[type="text"]');
    if (title === null) throw new Error('Title input is unavailable.');
    title.value = 'Changed';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const issueButton = root.querySelector<HTMLButtonElement>('.actions button');
    expect(issueButton?.disabled).toBe(true);
    issueButton?.click();
    expect(issue).not.toHaveBeenCalled();
  });

  it('rejects an invalid invoice identifier', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ invoiceId: 'invalid' }) } },
        },
        { provide: OrdersApi, useValue: {} },
        { provide: InvoicesApi, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceEditor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toMatch(
      /introuvable|not found/,
    );
  });
});
