import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  AccountingAccount,
  AccountingAccountList,
  AccountingAccountWrite,
  AccountingBalanceReport,
  AccountingEntry,
  AccountingEntryCommand,
  AccountingEntryCreate,
  AccountingEntryList,
  AccountingEvidence,
  AccountingEvidenceCreate,
  AccountingEvidenceList,
  AccountingFailure,
  AccountingJournal,
  AccountingJournalList,
  AccountingJournalWrite,
  AccountingLetterableLineList,
  AccountingLettering,
  AccountingLetteringCreate,
  AccountingLedgerReport,
  AccountingPeriod,
  AccountingPeriodCreate,
  AccountingPeriodList,
  AccountingPeriodTransition,
  AccountingReportQuery,
  AccountingFinancialReport,
  AccountingTaxReport,
  AccountingTaxFilingSettings,
  AccountingTaxFilingSettingsUpdate,
  AccountingTaxFilingRequest,
  AccountingTaxFilingSubmission,
  AccountingTaxFilingSubmissionList,
  OpeningBalanceCommit,
  OpeningBalancePreview,
  OpeningBalanceRequest,
} from './contracts.js';

export class AccountingApi extends HttpApiGroup.make('accounting', { topLevel: true }).add(
  HttpApiEndpoint.get('accountingAccountList', '/api/accounting/accounts', {
    success: AccountingAccountList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingAccountCreate', '/api/accounting/accounts', {
    payload: AccountingAccountWrite,
    success: AccountingAccount,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('accountingAccountUpdate', '/api/accounting/accounts/:id', {
    params: { id: Ulid },
    payload: AccountingAccountWrite,
    success: AccountingAccount,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingJournalList', '/api/accounting/journals', {
    success: AccountingJournalList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingJournalCreate', '/api/accounting/journals', {
    payload: AccountingJournalWrite,
    success: AccountingJournal,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('accountingJournalUpdate', '/api/accounting/journals/:id', {
    params: { id: Ulid },
    payload: AccountingJournalWrite,
    success: AccountingJournal,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingPeriodList', '/api/accounting/periods', {
    success: AccountingPeriodList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingPeriodCreate', '/api/accounting/periods', {
    payload: AccountingPeriodCreate,
    success: AccountingPeriod,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingPeriodLock', '/api/accounting/periods/:id/lock', {
    params: { id: Ulid },
    payload: AccountingPeriodTransition,
    success: AccountingPeriod,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingPeriodClose', '/api/accounting/periods/:id/close', {
    params: { id: Ulid },
    payload: AccountingPeriodTransition,
    success: AccountingPeriod,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingPeriodFinalClose', '/api/accounting/periods/:id/final-close', {
    params: { id: Ulid },
    payload: AccountingPeriodTransition,
    success: AccountingPeriod,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingPeriodReopen', '/api/accounting/periods/:id/reopen', {
    params: { id: Ulid },
    payload: AccountingPeriodTransition,
    success: AccountingPeriod,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingEntryList', '/api/accounting/entries', {
    success: AccountingEntryList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingEntryCreate', '/api/accounting/entries', {
    payload: AccountingEntryCreate,
    success: AccountingEntry,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingEntryPost', '/api/accounting/entries/:id/post', {
    params: { id: Ulid },
    payload: AccountingEntryCommand,
    success: AccountingEntry,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingValidate]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingEntryReverse', '/api/accounting/entries/:id/reverse', {
    params: { id: Ulid },
    payload: AccountingEntryCommand,
    success: AccountingEntry,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingValidate]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingLetterableLineList', '/api/accounting/lettering/lines', {
    success: AccountingLetterableLineList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingLetteringCreate', '/api/accounting/lettering', {
    payload: AccountingLetteringCreate,
    success: AccountingLettering,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingBalanceReport', '/api/accounting/reports/balance', {
    query: AccountingReportQuery,
    success: AccountingBalanceReport,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingLedgerReport', '/api/accounting/reports/ledger', {
    query: AccountingReportQuery,
    success: AccountingLedgerReport,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingFinancialReport', '/api/accounting/reports/financial-statements', {
    query: AccountingReportQuery,
    success: AccountingFinancialReport,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingTaxReport', '/api/accounting/reports/france/vat', {
    query: AccountingReportQuery,
    success: AccountingTaxReport,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingCa3Export', '/api/accounting/reports/france/ca3', {
    query: AccountingReportQuery,
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'application/json' })),
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingExport]), authenticate),
  HttpApiEndpoint.get('accountingFecExport', '/api/accounting/reports/fec', {
    query: AccountingReportQuery,
    success: Schema.String.pipe(HttpApiSchema.asText({ contentType: 'text/plain; charset=utf-8' })),
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingExport]), authenticate),
  HttpApiEndpoint.get('accountingTaxFilingSettings', '/api/accounting/tax-filing/settings', {
    success: AccountingTaxFilingSettings,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingExport]), authenticate, frontendSpecific),
  HttpApiEndpoint.put('accountingTaxFilingSettingsUpdate', '/api/accounting/tax-filing/settings', {
    payload: AccountingTaxFilingSettingsUpdate,
    success: AccountingTaxFilingSettings,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingTaxFilingSubmissionList', '/api/accounting/tax-filings', {
    success: AccountingTaxFilingSubmissionList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingExport]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingTaxFilingSubmit', '/api/accounting/tax-filings', {
    payload: AccountingTaxFilingRequest,
    success: AccountingTaxFilingSubmission,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingClose]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingOpeningPreview', '/api/accounting/opening-balances/preview', {
    payload: OpeningBalanceRequest,
    success: OpeningBalancePreview,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingWrite]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingOpeningCommit', '/api/accounting/opening-balances', {
    payload: OpeningBalanceCommit,
    success: AccountingEntry,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingValidate]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingEvidenceList', '/api/accounting/evidence', {
    success: AccountingEvidenceList,
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingRead]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('accountingEvidenceCreate', '/api/accounting/evidence', {
    payload: AccountingEvidenceCreate,
    success: AccountingEvidence,
    error: AccountingFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.accountingEvidence]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('accountingEvidenceDownload', '/api/accounting/evidence/:id/download', {
    params: { id: Ulid },
    success: Schema.Uint8Array.pipe(
      HttpApiSchema.asUint8Array({ contentType: 'application/octet-stream' }),
    ),
    error: AccountingFailure.members,
  }).pipe(requirePermissions([Permissions.accountingEvidence]), authenticate, frontendSpecific),
) {}
