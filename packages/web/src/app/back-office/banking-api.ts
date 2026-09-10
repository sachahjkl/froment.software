import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BankFailure,
  BankMatchHistory,
  BankMatchRequest,
  BankPaymentList,
  BankImportResult,
  BankImportPreview,
  BankTransactionList,
  BankTransaction,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class BankingApi {
  private readonly http = inject(HttpClient);
  payments(invoiceId: string) {
    return requestOutcome(
      this.http.get(`/api/banking/invoices/${invoiceId}/payments`),
      BankPaymentList,
      BankFailure,
      'bank.error',
    );
  }
  history(id: string) {
    return requestOutcome(
      this.http.get<unknown>(`/api/banking/transactions/${id}/history`),
      BankMatchHistory,
      BankFailure,
      'bank.error',
    );
  }
  async list() {
    return Schema.decodeUnknownSync(BankTransactionList)(
      await firstValueFrom(this.http.get<unknown>('/api/banking/transactions')),
    );
  }
  get(id: string) {
    return requestOutcome(
      this.http.get<unknown>(`/api/banking/transactions/${id}`),
      BankTransaction,
      BankFailure,
      'bank.error',
    );
  }
  importStatement(request: BankImportRequestValue) {
    return requestOutcome(
      this.http.post<unknown>('/api/banking/import', request),
      BankImportResult,
      BankFailure,
      'bank.error',
    );
  }
  previewStatement(request: BankImportRequestValue) {
    return requestOutcome(
      this.http.post<unknown>('/api/banking/import/preview', request),
      BankImportPreview,
      BankFailure,
      'bank.error',
    );
  }
  match(id: string, request: typeof BankMatchRequest.Type) {
    return requestOutcome(
      this.http.post<unknown>(`/api/banking/transactions/${id}/match`, request),
      BankTransactionList,
      BankFailure,
      'bank.error',
    );
  }
  unmatch(id: string, matchId: string, reason: string) {
    return requestOutcome(
      this.http.post<unknown>(`/api/banking/transactions/${id}/unmatch`, { matchId, reason }),
      BankTransactionList,
      BankFailure,
      'bank.error',
    );
  }
}
