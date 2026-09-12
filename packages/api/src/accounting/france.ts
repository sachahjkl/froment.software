import { AccountingTaxReport, type AccountingBalanceRow } from '@froment/contracts';
import type { AccountingJurisdiction } from './jurisdiction.js';

const balanceFor = (rows: ReadonlyArray<AccountingBalanceRow>, prefix: string): number =>
  rows
    .filter((row) => row.accountCode.startsWith(prefix))
    .reduce((total, row) => total + row.balanceCents, 0);

export const FranceAccountingJurisdiction: AccountingJurisdiction = {
  code: 'FR',
  taxReport: (startsOn, endsOn, rows) => {
    const collectedVatCents =
      -balanceFor(rows, '44571') - balanceFor(rows, '4452') - balanceFor(rows, '44551');
    const deductibleVatCents = balanceFor(rows, '44566');
    const payableVatCents = collectedVatCents - deductibleVatCents;
    return AccountingTaxReport.make({
      jurisdiction: 'FR',
      startsOn,
      endsOn,
      collectedVatCents,
      deductibleVatCents,
      payableVatCents,
      ca3: [
        { code: '16', amountCents: collectedVatCents },
        { code: '20', amountCents: deductibleVatCents },
        { code: '28', amountCents: payableVatCents },
      ],
    });
  },
  taxExport: (report) =>
    JSON.stringify({
      format: 'froment-ca3-v1',
      jurisdiction: report.jurisdiction,
      period: { startsOn: report.startsOn, endsOn: report.endsOn },
      boxes: report.ca3,
    }),
};
