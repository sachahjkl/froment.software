import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  LedgerConflict,
  LedgerEntry,
  LedgerList,
  LedgerPeriod,
  LedgerRequest,
  LedgerReverse,
} from '@froment/contracts';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class BankLedgerApi {
  private readonly http = inject(HttpClient);
  list(period: typeof LedgerPeriod.Type) {
    return requestOutcome(
      this.http.get('/api/banking/ledger', { params: period }),
      LedgerList,
      LedgerConflict,
      'ledger.error',
    );
  }
  post(request: typeof LedgerRequest.Type) {
    return requestOutcome(
      this.http.post('/api/banking/ledger', request),
      LedgerEntry,
      LedgerConflict,
      'ledger.error',
    );
  }
  reverse(id: string, request: typeof LedgerReverse.Type) {
    return requestOutcome(
      this.http.post(`/api/banking/ledger/${id}/reverse`, request),
      LedgerEntry,
      LedgerConflict,
      'ledger.error',
    );
  }
}
