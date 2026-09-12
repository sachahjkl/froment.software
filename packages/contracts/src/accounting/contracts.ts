import { Schema } from 'effect';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { CurrencyCode } from '../company/contracts.js';
import { PositiveSafeInteger, SafeInteger } from '../documents/lines.js';
import { Ulid } from '../identifiers.js';
import { CalendarDate } from '../temporal.js';

const SignedSafeInteger = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(Number.MIN_SAFE_INTEGER),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
);

export const AccountCode = Schema.String.check(Schema.isPattern(/^\d{2,20}$/));
export const AccountKind = Schema.Literals(['asset', 'liability', 'equity', 'income', 'expense']);
export const AccountingAccount = Schema.Struct({
  id: Ulid,
  code: AccountCode,
  label: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  kind: AccountKind,
  system: Schema.Boolean,
  archived: Schema.Boolean,
  version: PositiveSafeInteger,
});
export type AccountingAccount = typeof AccountingAccount.Type;
export const AccountingAccountList = Schema.Array(AccountingAccount).check(
  Schema.isMaxLength(10_000),
);
export const AccountingAccountWrite = Schema.Struct({
  code: AccountCode,
  label: AccountingAccount.fields.label,
  kind: AccountKind,
  archived: Schema.Boolean,
  expectedVersion: Schema.NullOr(PositiveSafeInteger),
});
export type AccountingAccountWrite = typeof AccountingAccountWrite.Type;

export const AccountingJournal = Schema.Struct({
  id: Ulid,
  code: Schema.String.check(Schema.isPattern(/^[A-Z0-9]{2,10}$/)),
  label: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  kind: Schema.Literals(['sales', 'purchases', 'bank', 'general', 'opening']),
  archived: Schema.Boolean,
  version: PositiveSafeInteger,
});
export type AccountingJournal = typeof AccountingJournal.Type;
export const AccountingJournalList = Schema.Array(AccountingJournal);
export const AccountingJournalWrite = Schema.Struct({
  code: AccountingJournal.fields.code,
  label: AccountingJournal.fields.label,
  kind: AccountingJournal.fields.kind,
  archived: Schema.Boolean,
  expectedVersion: Schema.NullOr(PositiveSafeInteger),
});
export type AccountingJournalWrite = typeof AccountingJournalWrite.Type;

export const AccountingPeriodStatus = Schema.Literals(['open', 'locked', 'closed']);
export const AccountingPeriod = Schema.Struct({
  id: Ulid,
  label: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  status: AccountingPeriodStatus,
  finalClosed: Schema.Boolean,
  version: PositiveSafeInteger,
});
export type AccountingPeriod = typeof AccountingPeriod.Type;
export const AccountingPeriodList = Schema.Array(AccountingPeriod);
export const AccountingPeriodCreate = Schema.Struct({
  label: AccountingPeriod.fields.label,
  startsOn: CalendarDate,
  endsOn: CalendarDate,
});
export type AccountingPeriodCreate = typeof AccountingPeriodCreate.Type;
export const AccountingPeriodTransition = Schema.Struct({ expectedVersion: PositiveSafeInteger });

export const AccountingEntryLineInput = Schema.Struct({
  accountId: Ulid,
  label: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(240)),
  debitCents: SafeInteger,
  creditCents: SafeInteger,
});
export const AccountingEntryLine = Schema.Struct({
  id: Ulid,
  position: SafeInteger,
  ...AccountingEntryLineInput.fields,
});
export type AccountingEntryLine = typeof AccountingEntryLine.Type;
export const AccountingEntryStatus = Schema.Literals(['draft', 'posted', 'reversed']);
export const AccountingEntry = Schema.Struct({
  id: Ulid,
  requestId: Schema.String.check(Schema.isUUID(4)),
  journalId: Ulid,
  periodId: Ulid,
  entryDate: CalendarDate,
  reference: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  description: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(240)),
  currency: CurrencyCode,
  status: AccountingEntryStatus,
  reversalOfEntryId: Schema.NullOr(Ulid),
  version: PositiveSafeInteger,
  createdAt: Schema.Int,
  postedAt: Schema.NullOr(Schema.Int),
  lines: Schema.Array(AccountingEntryLine).check(Schema.isMinLength(2), Schema.isMaxLength(1_000)),
});
export type AccountingEntry = typeof AccountingEntry.Type;
export const AccountingEntryList = Schema.Array(AccountingEntry).check(Schema.isMaxLength(10_000));
export const AccountingEntryCreate = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  journalId: Ulid,
  periodId: Ulid,
  entryDate: CalendarDate,
  reference: AccountingEntry.fields.reference,
  description: AccountingEntry.fields.description,
  lines: Schema.Array(AccountingEntryLineInput).check(
    Schema.isMinLength(2),
    Schema.isMaxLength(1_000),
  ),
});
export type AccountingEntryCreate = typeof AccountingEntryCreate.Type;
export const AccountingEntryCommand = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  expectedVersion: PositiveSafeInteger,
});
export type AccountingEntryCommand = typeof AccountingEntryCommand.Type;

export const AccountingReportQuery = Schema.Struct({
  startsOn: CalendarDate,
  endsOn: CalendarDate,
});
export type AccountingReportQuery = typeof AccountingReportQuery.Type;
export const AccountingBalanceRow = Schema.Struct({
  accountCode: AccountCode,
  accountLabel: Schema.String,
  debitCents: SafeInteger,
  creditCents: SafeInteger,
  balanceCents: SignedSafeInteger,
});
export type AccountingBalanceRow = typeof AccountingBalanceRow.Type;
export const AccountingBalanceReport = Schema.Struct({
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  rows: Schema.Array(AccountingBalanceRow),
  debitCents: SafeInteger,
  creditCents: SafeInteger,
});
export type AccountingBalanceReport = typeof AccountingBalanceReport.Type;

export const AccountingLedgerRow = Schema.Struct({
  entryId: Ulid,
  entryDate: CalendarDate,
  journalCode: Schema.String,
  reference: Schema.String,
  description: Schema.String,
  accountCode: AccountCode,
  accountLabel: Schema.String,
  lineLabel: Schema.String,
  debitCents: SafeInteger,
  creditCents: SafeInteger,
});
export const AccountingLedgerReport = Schema.Struct({
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  rows: Schema.Array(AccountingLedgerRow),
});
export type AccountingLedgerReport = typeof AccountingLedgerReport.Type;
export const AccountingStatementSection = Schema.Struct({
  kind: AccountKind,
  rows: Schema.Array(AccountingBalanceRow),
  totalCents: SignedSafeInteger,
});
export const AccountingFinancialReport = Schema.Struct({
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  assets: AccountingStatementSection,
  liabilities: AccountingStatementSection,
  equity: AccountingStatementSection,
  income: AccountingStatementSection,
  expenses: AccountingStatementSection,
  netIncomeCents: SignedSafeInteger,
});
export type AccountingFinancialReport = typeof AccountingFinancialReport.Type;
export const AccountingTaxBox = Schema.Struct({
  code: Schema.String,
  amountCents: SignedSafeInteger,
});
export const AccountingTaxReport = Schema.Struct({
  jurisdiction: Schema.Literal('FR'),
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  collectedVatCents: SignedSafeInteger,
  deductibleVatCents: SignedSafeInteger,
  payableVatCents: SignedSafeInteger,
  ca3: Schema.Array(AccountingTaxBox),
});
export type AccountingTaxReport = typeof AccountingTaxReport.Type;
export const AccountingTaxFilingAdapter = Schema.Literals(['local', 'http']);
export const AccountingTaxFilingMaximumEndpointLength = 2_000;
export const AccountingTaxFilingMaximumCredentialLength = 2_000;
export const AccountingTaxFilingSettings = Schema.Struct({
  adapter: AccountingTaxFilingAdapter,
  endpoint: Schema.NullOr(Schema.String),
  credentialsPresent: Schema.Boolean,
  updatedAt: Schema.NullOr(Schema.Int),
});
export type AccountingTaxFilingSettings = typeof AccountingTaxFilingSettings.Type;
export const AccountingTaxFilingSettingsUpdate = Schema.Struct({
  adapter: AccountingTaxFilingAdapter,
  endpoint: Schema.NullOr(
    Schema.String.check(
      Schema.isPattern(/^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/),
      Schema.isMaxLength(AccountingTaxFilingMaximumEndpointLength),
    ),
  ),
  apiKey: Schema.NullOr(
    Schema.String.check(
      Schema.isPattern(/\S/),
      Schema.isMaxLength(AccountingTaxFilingMaximumCredentialLength),
    ),
  ),
});
export type AccountingTaxFilingSettingsUpdate = typeof AccountingTaxFilingSettingsUpdate.Type;
export const AccountingTaxFilingRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  ...AccountingReportQuery.fields,
});
export type AccountingTaxFilingRequest = typeof AccountingTaxFilingRequest.Type;
export const AccountingTaxFilingSubmission = Schema.Struct({
  id: Ulid,
  requestId: AccountingTaxFilingRequest.fields.requestId,
  adapter: AccountingTaxFilingAdapter,
  startsOn: CalendarDate,
  endsOn: CalendarDate,
  payloadSha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  providerReceipt: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(500)),
  submittedAt: Schema.Int,
});
export type AccountingTaxFilingSubmission = typeof AccountingTaxFilingSubmission.Type;
export const AccountingTaxFilingSubmissionList = Schema.Array(AccountingTaxFilingSubmission);

export const OpeningBalanceColumnMap = Schema.Struct({
  accountCode: Schema.String,
  accountLabel: Schema.String,
  debit: Schema.String,
  credit: Schema.String,
});
export const OpeningBalanceRequest = Schema.Struct({
  csv: Schema.String.check(Schema.isMaxLength(5_000_000)),
  delimiter: Schema.Literals([',', ';', '\t']),
  columns: OpeningBalanceColumnMap,
  entryDate: CalendarDate,
});
export type OpeningBalanceRequest = typeof OpeningBalanceRequest.Type;
export const OpeningBalancePreview = Schema.Struct({
  rows: Schema.Array(AccountingBalanceRow),
  debitCents: SafeInteger,
  creditCents: SafeInteger,
  balanced: Schema.Boolean,
});
export type OpeningBalancePreview = typeof OpeningBalancePreview.Type;
export const OpeningBalanceCommit = Schema.Struct({
  ...OpeningBalanceRequest.fields,
  requestId: Schema.String.check(Schema.isUUID(4)),
  journalId: Ulid,
  periodId: Ulid,
});
export type OpeningBalanceCommit = typeof OpeningBalanceCommit.Type;

export const AccountingEvidence = Schema.Struct({
  id: Ulid,
  entryId: Ulid,
  fileName: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(255)),
  mediaType: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120)),
  size: PositiveSafeInteger,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  createdAt: Schema.Int,
});
export type AccountingEvidence = typeof AccountingEvidence.Type;
export const AccountingEvidenceList = Schema.Array(AccountingEvidence);
export const AccountingEvidenceCreate = Schema.Struct({
  entryId: Ulid,
  fileName: AccountingEvidence.fields.fileName,
  mediaType: AccountingEvidence.fields.mediaType,
  contentBase64: Schema.String.check(Schema.isMaxLength(20_000_000)),
});
export type AccountingEvidenceCreate = typeof AccountingEvidenceCreate.Type;

export const AccountingLetterableLine = Schema.Struct({
  lineId: Ulid,
  entryId: Ulid,
  entryDate: CalendarDate,
  reference: Schema.String,
  accountId: Ulid,
  accountCode: AccountCode,
  accountLabel: Schema.String,
  lineLabel: Schema.String,
  debitCents: SafeInteger,
  creditCents: SafeInteger,
  letteringCode: Schema.NullOr(Schema.String),
});
export type AccountingLetterableLine = typeof AccountingLetterableLine.Type;
export const AccountingLetterableLineList = Schema.Array(AccountingLetterableLine).check(
  Schema.isMaxLength(10_000),
);
export const AccountingLetteringCreate = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  lineIds: Schema.Array(Ulid).check(Schema.isMinLength(2), Schema.isMaxLength(1_000)),
});
export type AccountingLetteringCreate = typeof AccountingLetteringCreate.Type;
export const AccountingLettering = Schema.Struct({
  id: Ulid,
  code: Schema.String,
  accountId: Ulid,
  lineIds: Schema.Array(Ulid),
  createdAt: Schema.Int,
});
export type AccountingLettering = typeof AccountingLettering.Type;

export class AccountingConflict extends Schema.TaggedError<AccountingConflict>()(
  'AccountingConflict',
  {
    code: Schema.Literals([
      'accounting.not_found',
      'accounting.version_conflict',
      'accounting.code_conflict',
      'accounting.period_overlap',
      'accounting.period_not_open',
      'accounting.period_final_closed',
      'accounting.period_transition_invalid',
      'accounting.period_has_drafts',
      'accounting.entry_unbalanced',
      'accounting.entry_not_draft',
      'accounting.entry_not_posted',
      'accounting.opening_unbalanced',
      'accounting.csv_invalid',
      'accounting.lettering_invalid',
      'accounting.lettering_conflict',
      'accounting.tax_filing_configuration_invalid',
      'accounting.tax_filing_failed',
      'accounting.encryption_unavailable',
    ]),
  },
) {}
export const AccountingFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  AccountingConflict,
]);
