import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  SupplierInvoice,
  SupplierInvoiceCreateRequest,
  SupplierInvoiceFailure,
  SupplierInvoiceList,
  SupplierInvoiceUpdateRequest,
} from '@froment/contracts';

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
  create(request: typeof SupplierInvoiceCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/supplier-invoices', request),
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
}
