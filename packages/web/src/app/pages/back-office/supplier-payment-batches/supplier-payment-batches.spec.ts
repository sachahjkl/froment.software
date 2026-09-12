import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { SupplierPaymentBatchesPage } from './supplier-payment-batches';

const invoice = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  supplierId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  supplierName: 'Test supplier',
  reference: 'SUP-42',
  invoiceDate: '2026-09-01',
  dueDate: '2026-10-01',
  currency: 'EUR',
  lines: [],
  notes: '',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  status: 'approved',
  source: 'manual',
  sourceFileName: null,
  externalSubmissionId: null,
  confirmedAt: 1,
  approvedAt: 2,
  version: 3,
  createdAt: 1,
  updatedAt: 2,
} as const;

it('creates a payment batch from selected approved EUR invoices', async () => {
  const createPaymentBatch = vi
    .fn()
    .mockImplementation(async (request: { executionDate: string }) => ({
      success: true,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
        messageId: 'FRO-01ARZ3NDEKTSV4RRFFQ69G5FAX',
        executionDate: request.executionDate,
        transactionCount: 1,
        controlSumCents: invoice.totalCents,
        createdAt: 3,
        invoices: [
          {
            invoiceId: invoice.id,
            reference: invoice.reference,
            supplierName: invoice.supplierName,
            amountCents: invoice.totalCents,
          },
        ],
      },
    }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: SupplierInvoicesApi,
        useValue: {
          list: async () => ({
            success: true,
            result: [invoice, { ...invoice, id: '01ARZ3NDEKTSV4RRFFQ69G5FAY', currency: 'USD' }],
          }),
          paymentBatches: async () => ({ success: true, result: [] }),
          createPaymentBatch,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(SupplierPaymentBatchesPage);
  await fixture.whenStable();
  const component = fixture.componentInstance;
  expect(component['eligibleInvoices']()).toEqual([invoice]);

  component['selectedIds'].set([invoice.id]);
  component['executionDate'].set('2026-10-01');
  await component['create']();

  expect(createPaymentBatch).toHaveBeenCalledWith(
    expect.objectContaining({ executionDate: '2026-10-01', invoiceIds: [invoice.id] }),
  );
  expect(component['created']()?.controlSumCents).toBe(invoice.totalCents);
  expect(component['selectedIds']()).toEqual([]);
});
