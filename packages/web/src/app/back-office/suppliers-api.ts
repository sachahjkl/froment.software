import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  SupplierFailure,
  SupplierList,
  SupplierSummary,
  type SupplierCreateRequestValue,
  type SupplierFailureValue,
  type SupplierListValue,
  type SupplierSummaryValue,
  type SupplierUpdateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { firstValueFrom } from 'rxjs';
import { Schema } from 'effect';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type SupplierOutcome<T> = ApiOutcome<T, SupplierFailureValue, 'supplier.error'>;

@Injectable({ providedIn: 'root' })
export class SuppliersApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<SupplierListValue> {
    return Schema.decodeUnknownSync(SupplierList)(
      await firstValueFrom(this.http.get<unknown>('/api/suppliers')),
    );
  }

  async get(supplierId: UlidValue): Promise<SupplierOutcome<SupplierSummaryValue>> {
    return requestOutcome(
      this.http.get<unknown>(`/api/suppliers/${supplierId}`),
      SupplierSummary,
      SupplierFailure,
      'supplier.error',
    );
  }

  async create(
    request: SupplierCreateRequestValue,
  ): Promise<SupplierOutcome<SupplierSummaryValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/suppliers', request),
      SupplierSummary,
      SupplierFailure,
      'supplier.error',
    );
  }

  async update(
    supplierId: UlidValue,
    request: SupplierUpdateRequestValue,
  ): Promise<SupplierOutcome<SupplierSummaryValue>> {
    return requestOutcome(
      this.http.put<unknown>(`/api/suppliers/${supplierId}`, request),
      SupplierSummary,
      SupplierFailure,
      'supplier.error',
    );
  }

  async archive(supplierId: UlidValue): Promise<SupplierOutcome<SupplierSummaryValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/suppliers/${supplierId}/archive`, undefined),
      SupplierSummary,
      SupplierFailure,
      'supplier.error',
    );
  }

  async reactivate(supplierId: UlidValue): Promise<SupplierOutcome<SupplierSummaryValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/suppliers/${supplierId}/reactivate`, undefined),
      SupplierSummary,
      SupplierFailure,
      'supplier.error',
    );
  }
}
