import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CompanyFailure,
  CompanySettings,
  type AccountingInitializeRequestValue,
  type CompanyFailureValue,
  type CompanySettingsUpdateRequestValue,
  type CompanySettingsValue,
} from '@froment/contracts';
import { requestOutcome, type ApiOutcome } from '@shared/api-outcome';

export type CompanyOutcome = ApiOutcome<CompanySettingsValue, CompanyFailureValue, 'company.error'>;

@Injectable({ providedIn: 'root' })
export class CompanyApi {
  private readonly http = inject(HttpClient);

  async get(): Promise<CompanyOutcome> {
    return requestOutcome(
      this.http.get<unknown>('/api/company'),
      CompanySettings,
      CompanyFailure,
      'company.error',
    );
  }

  async update(request: CompanySettingsUpdateRequestValue): Promise<CompanyOutcome> {
    return requestOutcome(
      this.http.put<unknown>('/api/company', request),
      CompanySettings,
      CompanyFailure,
      'company.error',
    );
  }

  async initializeAccounting(request: AccountingInitializeRequestValue): Promise<CompanyOutcome> {
    return requestOutcome(
      this.http.post<unknown>('/api/company/accounting/initialize', request),
      CompanySettings,
      CompanyFailure,
      'company.error',
    );
  }
}
