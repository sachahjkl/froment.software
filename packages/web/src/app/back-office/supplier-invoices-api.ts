import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  SupplierInvoice,
  SupplierInvoiceAnalysisRequest,
  SupplierInvoiceAnalysisSettings,
  SupplierInvoiceAnalysisStatus,
  SupplierInvoiceAnalysisSettingsUpdate,
  SupplierInvoiceCreateRequest,
  SupplierCreditCreateRequest,
  SupplierInvoiceFailure,
  SupplierInvoiceEvidence,
  SupplierInvoiceEvidenceList,
  SupplierInvoiceList,
  SupplierInvoiceUpdateRequest,
  SupplierPaymentBatch,
  SupplierPaymentBatchCreateRequest,
  SupplierPaymentBatchList,
} from '@froment/contracts';
import { firstValueFrom } from 'rxjs';

import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class SupplierInvoicesApi {
  private readonly http = inject(HttpClient);
  list() {
    return requestOutcome(
      this.http.get('/api/supplier-invoices'),
      SupplierInvoiceList,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  get(id: string) {
    return requestOutcome(
      this.http.get(`/api/supplier-invoices/${id}`),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  evidence(id: string) {
    return requestOutcome(
      this.http.get(`/api/supplier-invoices/${id}/evidence`),
      SupplierInvoiceEvidenceList,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  createEvidence(request: {
    readonly invoiceId: string;
    readonly fileName: string;
    readonly mediaType: string;
    readonly contentBase64: string;
  }) {
    return requestOutcome(
      this.http.post('/api/supplier-invoice-evidence', request),
      SupplierInvoiceEvidence,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  downloadEvidence(id: string) {
    return firstValueFrom(
      this.http.get(`/api/supplier-invoice-evidence/${id}/download`, {
        responseType: 'blob',
      }),
    );
  }
  create(request: typeof SupplierInvoiceCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/supplier-invoices', request),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  createCredit(request: typeof SupplierCreditCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/supplier-credits', request),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  update(id: string, request: typeof SupplierInvoiceUpdateRequest.Type) {
    return requestOutcome(
      this.http.put(`/api/supplier-invoices/${id}`, request),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  transition(id: string, action: 'confirm' | 'approve' | 'cancel', expectedVersion: number) {
    return requestOutcome(
      this.http.post(`/api/supplier-invoices/${id}/${action}`, { expectedVersion }),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  analysisSettings() {
    return requestOutcome(
      this.http.get('/api/supplier-invoice-analysis/settings'),
      SupplierInvoiceAnalysisSettings,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  analysisStatus() {
    return requestOutcome(
      this.http.get('/api/supplier-invoice-analysis/status'),
      SupplierInvoiceAnalysisStatus,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  updateAnalysisSettings(request: typeof SupplierInvoiceAnalysisSettingsUpdate.Type) {
    return requestOutcome(
      this.http.put('/api/supplier-invoice-analysis/settings', request),
      SupplierInvoiceAnalysisSettings,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  analyze(request: typeof SupplierInvoiceAnalysisRequest.Type) {
    return requestOutcome(
      this.http.post('/api/supplier-invoices/analyze', request),
      SupplierInvoice,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  paymentBatches() {
    return requestOutcome(
      this.http.get('/api/supplier-payment-batches'),
      SupplierPaymentBatchList,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
  createPaymentBatch(request: typeof SupplierPaymentBatchCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/supplier-payment-batches', request),
      SupplierPaymentBatch,
      SupplierInvoiceFailure,
      'supplierInvoice.error',
    );
  }
}
