import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  InvoiceDetail,
  InvoiceDocumentArtifact,
  InvoiceFailure,
  InvoiceIssueResult,
  InvoiceList,
  type InvoiceCreateRequestValue,
  type InvoiceDetailValue,
  type InvoiceDocumentArtifactValue,
  type InvoiceFailureValue,
  type InvoiceIssueResultValue,
  type InvoiceListValue,
  type InvoiceRevisionCreateRequestValue,
  type InvoiceTransitionRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type InvoiceErrorCode = InvoiceFailureValue['code'] | 'invoice.error';
export type InvoiceOutcome<T> = ApiOutcome<T, InvoiceFailureValue, 'invoice.error'>;

@Injectable({ providedIn: 'root' })
export class InvoicesApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<InvoiceListValue> {
    return Schema.decodeUnknownSync(InvoiceList)(
      await firstValueFrom(this.http.get<unknown>('/api/invoices')),
    );
  }

  async get(invoiceId: UlidValue): Promise<InvoiceOutcome<InvoiceDetailValue>> {
    return requestOutcome(
      this.http.get<unknown>(`/api/invoices/${invoiceId}`),
      InvoiceDetail,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async create(request: InvoiceCreateRequestValue): Promise<InvoiceOutcome<InvoiceDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>('/api/invoices', request),
      InvoiceDetail,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async createRevision(
    invoiceId: UlidValue,
    request: InvoiceRevisionCreateRequestValue,
  ): Promise<InvoiceOutcome<InvoiceDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/invoices/${invoiceId}/revisions`, request),
      InvoiceDetail,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async issue(
    invoiceId: UlidValue,
    expectedVersion: number,
  ): Promise<InvoiceOutcome<InvoiceIssueResultValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/invoices/${invoiceId}/issue`, { expectedVersion }),
      InvoiceIssueResult,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async markPaid(
    invoiceId: UlidValue,
    request: InvoiceTransitionRequestValue,
  ): Promise<InvoiceOutcome<InvoiceDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/invoices/${invoiceId}/mark-paid`, request),
      InvoiceDetail,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async void(
    invoiceId: UlidValue,
    request: InvoiceTransitionRequestValue,
  ): Promise<InvoiceOutcome<InvoiceDetailValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/invoices/${invoiceId}/void`, request),
      InvoiceDetail,
      InvoiceFailure,
      'invoice.error',
    );
  }

  async renderPdf(
    invoiceId: UlidValue,
    version: number,
  ): Promise<InvoiceOutcome<InvoiceDocumentArtifactValue>> {
    return requestOutcome(
      this.http.post<unknown>(`/api/invoices/${invoiceId}/revisions/${version}/pdf`, undefined),
      InvoiceDocumentArtifact,
      InvoiceFailure,
      'invoice.error',
    );
  }
}
