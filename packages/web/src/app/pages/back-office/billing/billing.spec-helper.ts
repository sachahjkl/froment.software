import { provideAccount } from '@backoffice/account.spec-helper';
import type { PermissionCodeValue } from '@froment/contracts';
import { type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import {
  type InvoiceDetailValue,
  type InvoicePaymentValue,
  type OrderListValue,
  InvoiceCredits,
} from '@froment/contracts';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { OrdersApi } from '@backoffice/orders-api';

export const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
export const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
export const paymentFixture = (): InvoicePaymentValue => ({
  id: '01ARZ3NDEKTSV4RRFFQ69G5FB9',
  requestId: '662c2994-179f-45e7-a36c-35127883ccdb',
  expectedVersion: 2,
  amountCents: 400,
  paidOn: '2026-08-20',
  method: 'transfer',
  reference: 'BANK-456',
  recordedAt: '2026-08-20T12:00:00.000Z',
  recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  cancelledAt: null,
  cancelledByUserId: null,
  cancellationReason: null,
});
export const invoiceFixture = (
  status: InvoiceDetailValue['status'] = 'issued',
): InvoiceDetailValue => {
  const revision = {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    version: 2,
    clientDisplayName: 'Acme',
    invoiceNumber: status === 'draft' ? null : 'FA-2026-000001',
    issuedAt: status === 'draft' ? null : '2026-08-20T06:00:00.000Z',
    title: 'Audit',
    serviceDate: '2026-08-20',
    dueDate: '2026-09-20',
    paymentTerms: '30 days',
    currency: 'EUR' as const,
    netTotalCents: 1000,
    vatTotalCents: 200,
    totalCents: 1200,
    functionalCurrency: status === 'draft' ? null : ('EUR' as const),
    exchangeRateDate: status === 'draft' ? null : '2026-08-20',
    foreignUnitsPerFunctionalUnitNanos: status === 'draft' ? null : 1_000_000_000,
    functionalNetTotalCents: status === 'draft' ? null : 1000,
    functionalVatTotalCents: status === 'draft' ? null : 200,
    functionalTotalCents: status === 'draft' ? null : 1200,
    createdAt: '2026-08-20T06:00:00.000Z',
    createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
    lines: [
      {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAT',
        position: 0,
        description: 'Audit',
        quantityMilli: 1000,
        unitPriceCents: 1000,
        vatRateBasisPoints: 2000,
        netTotalCents: 1000,
        vatTotalCents: 200,
        totalCents: 1200,
      },
    ],
  };
  return {
    id: invoiceId,
    orderId,
    orderReference: 'CO-2026-000001',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    status,
    version: 2,
    invoiceNumber: revision.invoiceNumber,
    issuedAt: revision.issuedAt,
    paidAt: status === 'paid' ? '2026-08-21T06:00:00.000Z' : null,
    voidedAt: status === 'void' ? '2026-08-21T06:00:00.000Z' : null,
    currentRevision: revision,
    revisions: [revision],
    payments: [],
    creditedCents: 0,
    pdf: status === 'draft' ? null : { status: 'ready', attempts: 1, error: null },
  };
};
export const creditFixture = (): typeof InvoiceCredits.Type => ({
  creditNotes: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FB8',
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      status: 'issued',
      version: 1,
      requestId: '8599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
      issueRequestId: '9599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
      number: 'AV-2026-000001',
      reason: 'Service cancelled',
      currency: 'EUR',
      createdAt: '2026-08-21T05:00:00.000Z',
      createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      issuedAt: '2026-08-21T06:00:00.000Z',
      issuedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      netTotalCents: 1000,
      vatTotalCents: 200,
      totalCents: 1200,
      lines: [
        {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FB9',
          invoiceId,
          invoiceVersion: 2,
          invoiceNumber: 'FA-2026-000001',
          sourceLineId: '01ARZ3NDEKTSV4RRFFQ69G5FAT',
          position: 0,
          description: 'Service',
          quantityMilli: 1000,
          unitPriceCents: 1000,
          vatRateBasisPoints: 2000,
          netTotalCents: 1000,
          vatTotalCents: 200,
          totalCents: 1200,
        },
      ],
      revisions: [
        {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FBA',
          version: 1,
          reason: 'Service cancelled',
          createdAt: '2026-08-21T05:00:00.000Z',
          createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
          netTotalCents: 1000,
          vatTotalCents: 200,
          totalCents: 1200,
          lines: [
            {
              id: '01ARZ3NDEKTSV4RRFFQ69G5FB9',
              invoiceId,
              invoiceVersion: 2,
              invoiceNumber: 'FA-2026-000001',
              sourceLineId: '01ARZ3NDEKTSV4RRFFQ69G5FAT',
              position: 0,
              description: 'Service',
              quantityMilli: 1000,
              unitPriceCents: 1000,
              vatRateBasisPoints: 2000,
              netTotalCents: 1000,
              vatTotalCents: 200,
              totalCents: 1200,
            },
          ],
        },
      ],
    },
  ],
  refunds: [],
  allocations: [],
  refundableCents: 400,
});
export const inputValue = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void => {
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
};
export const field = (root: HTMLElement, selector: string): HTMLInputElement => {
  const result = root.querySelector<HTMLInputElement>(selector);
  if (!result) throw new Error('billing.test.field_missing');
  return result;
};
export const submitForm = (root: HTMLElement): void => {
  root
    .querySelector('form')
    ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
};

export async function setupInvoicePage<T>(
  component: Type<T>,
  options: {
    invoice?: InvoiceDetailValue;
    credits?: typeof InvoiceCredits.Type;
    params?: Record<string, string>;
    query?: Record<string, string>;
    orders?: OrderListValue;
    permissions?: readonly PermissionCodeValue[];
  } = {},
) {
  const invoice = options.invoice ?? invoiceFixture();
  const api = {
    get: vi.fn<InvoicesApi['get']>().mockResolvedValue({ success: true, result: invoice }),
    create: vi.fn<InvoicesApi['create']>(),
    createRevision: vi.fn<InvoicesApi['createRevision']>(),
    issue: vi.fn<InvoicesApi['issue']>(),
    recordPayment: vi.fn<InvoicesApi['recordPayment']>(),
    cancelPayment: vi.fn<InvoicesApi['cancelPayment']>(),
    void: vi.fn<InvoicesApi['void']>(),
    renderPdf: vi.fn<InvoicesApi['renderPdf']>(),
    history: vi.fn<InvoicesApi['history']>().mockResolvedValue({ success: true, result: [] }),
  };
  const credits = {
    get: vi.fn<InvoiceCreditsApi['get']>().mockResolvedValue({
      success: true,
      result: options.credits ?? {
        creditNotes: [],
        refunds: [],
        allocations: [],
        refundableCents: 0,
      },
    }),
    create: vi.fn<InvoiceCreditsApi['create']>(),
    update: vi.fn<InvoiceCreditsApi['update']>(),
    issue: vi.fn<InvoiceCreditsApi['issue']>(),
    refund: vi.fn<InvoiceCreditsApi['refund']>(),
    cancel: vi.fn<InvoiceCreditsApi['cancel']>(),
  };
  const params = convertToParamMap(options.params ?? { invoiceId });
  const query = convertToParamMap(options.query ?? {});
  const queryParams = new BehaviorSubject(query);
  TestBed.configureTestingModule({
    providers: [
      provideAccount(options.permissions),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: params, queryParamMap: query },
          paramMap: of(params),
          queryParamMap: queryParams,
        },
      },
      { provide: InvoicesApi, useValue: api },
      { provide: InvoiceCreditsApi, useValue: credits },
      { provide: OrdersApi, useValue: { list: vi.fn().mockResolvedValue(options.orders ?? []) } },
    ],
  });
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  return { api, credits, fixture, root, queryParams };
}
