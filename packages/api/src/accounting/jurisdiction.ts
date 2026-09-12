import type { AccountingBalanceRow, AccountingTaxReport } from '@froment/contracts';

export interface AccountingJurisdiction {
  readonly code: string;
  readonly taxReport: (
    startsOn: string,
    endsOn: string,
    rows: ReadonlyArray<AccountingBalanceRow>,
  ) => AccountingTaxReport;
  readonly taxExport: (report: AccountingTaxReport) => string;
}
