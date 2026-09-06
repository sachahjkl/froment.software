import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BankFailure,
  BankImportResult,
  BankTransactionList,
  type BankImportRequestValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class BankingApi {
  private readonly http = inject(HttpClient);
  async list() {
    return Schema.decodeUnknownSync(BankTransactionList)(
      await firstValueFrom(this.http.get<unknown>('/api/banking/transactions')),
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
  match(id: string, paymentId: string) {
    return requestOutcome(
      this.http.post<unknown>(`/api/banking/transactions/${id}/match`, { paymentId }),
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
