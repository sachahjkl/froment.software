import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  AccountingAccount,
  AccountingAccountList,
  AccountingBalanceReport,
  AccountingEntry,
  AccountingEntryList,
  AccountingEvidence,
  AccountingEvidenceList,
  AccountingFailure,
  AccountingFinancialReport,
  AccountingJournal,
  AccountingJournalList,
  AccountingLetterableLineList,
  AccountingLettering,
  AccountingLedgerReport,
  AccountingPeriod,
  AccountingPeriodList,
  AccountingTaxReport,
  AccountingTaxFilingSettings,
  AccountingTaxFilingSubmission,
  AccountingTaxFilingSubmissionList,
  OpeningBalancePreview,
  type AccountingAccountWrite,
  type AccountingEntryCommand,
  type AccountingEntryCreate,
  type AccountingEvidenceCreate,
  type AccountingJournalWrite,
  type AccountingLetteringCreate,
  type AccountingPeriodCreate,
  type AccountingReportQuery,
  type AccountingTaxFilingSettingsUpdate,
  type OpeningBalanceCommit,
  type OpeningBalanceRequest,
} from '@froment/contracts';
import { requestOutcome } from '@shared/api-outcome';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AccountingApi {
  private readonly http = inject(HttpClient);

  listAccounts() {
    return requestOutcome(
      this.http.get('/api/accounting/accounts'),
      AccountingAccountList,
      AccountingFailure,
      'accounting.error',
    );
  }
  writeAccount(id: string | null, request: AccountingAccountWrite) {
    if (id === null) {
      return requestOutcome(
        this.http.post('/api/accounting/accounts', request),
        AccountingAccount,
        AccountingFailure,
        'accounting.error',
      );
    }
    const source = this.http.put(`/api/accounting/accounts/${id}`, request);
    return requestOutcome(source, AccountingAccount, AccountingFailure, 'accounting.error');
  }
  listJournals() {
    return requestOutcome(
      this.http.get('/api/accounting/journals'),
      AccountingJournalList,
      AccountingFailure,
      'accounting.error',
    );
  }
  writeJournal(id: string | null, request: AccountingJournalWrite) {
    if (id === null) {
      return requestOutcome(
        this.http.post('/api/accounting/journals', request),
        AccountingJournal,
        AccountingFailure,
        'accounting.error',
      );
    }
    const source = this.http.put(`/api/accounting/journals/${id}`, request);
    return requestOutcome(source, AccountingJournal, AccountingFailure, 'accounting.error');
  }
  listPeriods() {
    return requestOutcome(
      this.http.get('/api/accounting/periods'),
      AccountingPeriodList,
      AccountingFailure,
      'accounting.error',
    );
  }
  createPeriod(request: AccountingPeriodCreate) {
    return requestOutcome(
      this.http.post('/api/accounting/periods', request),
      AccountingPeriod,
      AccountingFailure,
      'accounting.error',
    );
  }
  transitionPeriod(
    id: string,
    action: 'lock' | 'close' | 'reopen' | 'final-close',
    expectedVersion: number,
  ) {
    return requestOutcome(
      this.http.post(`/api/accounting/periods/${id}/${action}`, { expectedVersion }),
      AccountingPeriod,
      AccountingFailure,
      'accounting.error',
    );
  }
  listEntries() {
    return requestOutcome(
      this.http.get('/api/accounting/entries'),
      AccountingEntryList,
      AccountingFailure,
      'accounting.error',
    );
  }
  listLetterableLines() {
    return requestOutcome(
      this.http.get('/api/accounting/lettering/lines'),
      AccountingLetterableLineList,
      AccountingFailure,
      'accounting.error',
    );
  }
  createLettering(request: AccountingLetteringCreate) {
    return requestOutcome(
      this.http.post('/api/accounting/lettering', request),
      AccountingLettering,
      AccountingFailure,
      'accounting.error',
    );
  }
  createEntry(request: AccountingEntryCreate) {
    return requestOutcome(
      this.http.post('/api/accounting/entries', request),
      AccountingEntry,
      AccountingFailure,
      'accounting.error',
    );
  }
  commandEntry(id: string, action: 'post' | 'reverse', request: AccountingEntryCommand) {
    return requestOutcome(
      this.http.post(`/api/accounting/entries/${id}/${action}`, request),
      AccountingEntry,
      AccountingFailure,
      'accounting.error',
    );
  }
  report(query: AccountingReportQuery) {
    return requestOutcome(
      this.http.get('/api/accounting/reports/balance', { params: this.params(query) }),
      AccountingBalanceReport,
      AccountingFailure,
      'accounting.error',
    );
  }
  ledger(query: AccountingReportQuery) {
    return requestOutcome(
      this.http.get('/api/accounting/reports/ledger', { params: this.params(query) }),
      AccountingLedgerReport,
      AccountingFailure,
      'accounting.error',
    );
  }
  financial(query: AccountingReportQuery) {
    return requestOutcome(
      this.http.get('/api/accounting/reports/financial-statements', { params: this.params(query) }),
      AccountingFinancialReport,
      AccountingFailure,
      'accounting.error',
    );
  }
  tax(query: AccountingReportQuery) {
    return requestOutcome(
      this.http.get('/api/accounting/reports/france/vat', { params: this.params(query) }),
      AccountingTaxReport,
      AccountingFailure,
      'accounting.error',
    );
  }
  async fec(query: AccountingReportQuery): Promise<string> {
    return firstValueFrom(
      this.http.get('/api/accounting/reports/fec', {
        params: this.params(query),
        responseType: 'text',
      }),
    ).then((value) => Schema.decodeUnknownSync(Schema.String)(JSON.parse(value)));
  }
  async ca3(query: AccountingReportQuery): Promise<string> {
    return firstValueFrom(
      this.http.get('/api/accounting/reports/france/ca3', {
        params: this.params(query),
        responseType: 'text',
      }),
    ).then((value) => Schema.decodeUnknownSync(Schema.String)(JSON.parse(value)));
  }
  taxFilingSettings() {
    return requestOutcome(
      this.http.get('/api/accounting/tax-filing/settings'),
      AccountingTaxFilingSettings,
      AccountingFailure,
      'accounting.error',
    );
  }
  updateTaxFilingSettings(request: AccountingTaxFilingSettingsUpdate) {
    return requestOutcome(
      this.http.put('/api/accounting/tax-filing/settings', request),
      AccountingTaxFilingSettings,
      AccountingFailure,
      'accounting.error',
    );
  }
  taxFilings() {
    return requestOutcome(
      this.http.get('/api/accounting/tax-filings'),
      AccountingTaxFilingSubmissionList,
      AccountingFailure,
      'accounting.error',
    );
  }
  submitTaxFiling(query: AccountingReportQuery) {
    return requestOutcome(
      this.http.post('/api/accounting/tax-filings', { ...query, requestId: crypto.randomUUID() }),
      AccountingTaxFilingSubmission,
      AccountingFailure,
      'accounting.error',
    );
  }
  previewOpening(request: OpeningBalanceRequest) {
    return requestOutcome(
      this.http.post('/api/accounting/opening-balances/preview', request),
      OpeningBalancePreview,
      AccountingFailure,
      'accounting.error',
    );
  }
  commitOpening(request: OpeningBalanceCommit) {
    return requestOutcome(
      this.http.post('/api/accounting/opening-balances', request),
      AccountingEntry,
      AccountingFailure,
      'accounting.error',
    );
  }
  listEvidence() {
    return requestOutcome(
      this.http.get('/api/accounting/evidence'),
      AccountingEvidenceList,
      AccountingFailure,
      'accounting.error',
    );
  }
  createEvidence(request: AccountingEvidenceCreate) {
    return requestOutcome(
      this.http.post('/api/accounting/evidence', request),
      AccountingEvidence,
      AccountingFailure,
      'accounting.error',
    );
  }
  downloadEvidence(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`/api/accounting/evidence/${id}/download`, { responseType: 'blob' }),
    );
  }
  private params(query: AccountingReportQuery) {
    return new HttpParams().set('startsOn', query.startsOn).set('endsOn', query.endsOn);
  }
}
