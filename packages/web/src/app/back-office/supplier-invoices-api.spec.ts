import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SupplierInvoicesApi } from './supplier-invoices-api';

const invoice = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  supplierId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  supplierName: 'Test supplier',
  reference: 'SUP-42',
  invoiceDate: '2026-09-01',
  dueDate: '2026-10-01',
  currency: 'EUR',
  lines: [
    {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      position: 0,
      description: 'Service',
      netTotalCents: 10_000,
      vatRateBasisPoints: 2_000,
      vatTotalCents: 2_000,
      totalCents: 12_000,
    },
  ],
  notes: '',
  netTotalCents: 10_000,
  vatTotalCents: 2_000,
  totalCents: 12_000,
  status: 'draft',
  source: 'manual',
  sourceFileName: null,
  externalSubmissionId: null,
  confirmedAt: null,
  approvedAt: null,
  version: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

describe('SupplierInvoicesApi', () => {
  it('sends supplier invoice lifecycle requests', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(SupplierInvoicesApi);
    const http = TestBed.inject(HttpTestingController);

    const list = api.list();
    http.expectOne('/api/supplier-invoices').flush([invoice]);
    await expect(list).resolves.toMatchObject({ success: true });

    const get = api.get(invoice.id);
    http.expectOne(`/api/supplier-invoices/${invoice.id}`).flush(invoice);
    await expect(get).resolves.toMatchObject({ success: true });

    const input = {
      supplierId: invoice.supplierId,
      reference: invoice.reference,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      lines: invoice.lines.map(({ description, netTotalCents, vatRateBasisPoints }) => ({
        description,
        netTotalCents,
        vatRateBasisPoints,
      })),
      notes: '',
    };
    const creation = {
      ...input,
      requestId: '97b85b47-577a-44db-b62a-5c0c7622b461',
      source: 'manual' as const,
      sourceFileName: null,
      externalSubmissionId: null,
    };
    const create = api.create(creation);
    const createRequest = http.expectOne('/api/supplier-invoices');
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(creation);
    createRequest.flush(invoice);
    await expect(create).resolves.toMatchObject({ success: true });

    const update = api.update(invoice.id, { ...input, expectedVersion: 1 });
    const updateRequest = http.expectOne(`/api/supplier-invoices/${invoice.id}`);
    expect(updateRequest.request.method).toBe('PUT');
    updateRequest.flush({ ...invoice, version: 2, updatedAt: 2 });
    await expect(update).resolves.toMatchObject({ success: true });

    for (const action of ['confirm', 'approve', 'cancel'] as const) {
      const transition = api.transition(invoice.id, action, 2);
      const transitionRequest = http.expectOne(`/api/supplier-invoices/${invoice.id}/${action}`);
      expect(transitionRequest.request.method).toBe('POST');
      expect(transitionRequest.request.body).toEqual({ expectedVersion: 2 });
      transitionRequest.flush({ ...invoice, version: 3, updatedAt: 3 });
      await expect(transition).resolves.toMatchObject({ success: true });
    }

    const settingsResult = api.analysisSettings();
    http.expectOne('/api/supplier-invoice-analysis/settings').flush({
      adapter: 'local',
      endpoint: null,
      credentialsPresent: false,
      external: false,
      updatedAt: null,
    });
    await expect(settingsResult).resolves.toMatchObject({ success: true });

    const statusResult = api.analysisStatus();
    http.expectOne('/api/supplier-invoice-analysis/status').flush({ external: false });
    await expect(statusResult).resolves.toMatchObject({ success: true });

    const settings = {
      adapter: 'http' as const,
      endpoint: 'https://analysis.example.test/invoices',
      apiKey: 'secret',
    };
    const settingsUpdate = api.updateAnalysisSettings(settings);
    const settingsRequest = http.expectOne('/api/supplier-invoice-analysis/settings');
    expect(settingsRequest.request.method).toBe('PUT');
    expect(settingsRequest.request.body).toEqual(settings);
    settingsRequest.flush({
      adapter: 'http',
      endpoint: settings.endpoint,
      credentialsPresent: true,
      external: true,
      updatedAt: 2,
    });
    await expect(settingsUpdate).resolves.toMatchObject({ success: true });

    const analysis = {
      requestId: '4d346efb-633e-48b9-8db3-9afbff408a40',
      supplierId: invoice.supplierId,
      fileName: 'invoice.pdf',
      mediaType: 'application/pdf' as const,
      contentBase64: 'dGVzdA==',
      consent: true,
    };
    const analysisResult = api.analyze(analysis);
    const analysisRequest = http.expectOne('/api/supplier-invoices/analyze');
    expect(analysisRequest.request.method).toBe('POST');
    expect(analysisRequest.request.body).toEqual(analysis);
    analysisRequest.flush({ ...invoice, source: 'ocr', sourceFileName: analysis.fileName });
    await expect(analysisResult).resolves.toMatchObject({ success: true });
    http.verify();
  });
});
