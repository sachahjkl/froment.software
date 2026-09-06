import type { LedgerEntry } from '@froment/contracts';

const cell = (value: string): string => {
  // Control prefixes can hide spreadsheet formulas.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};
export const ledgerCsv = (entries: ReadonlyArray<typeof LedgerEntry.Type>): string => {
  const rows = entries.flatMap((entry) => {
    const cents = BigInt(entry.amountCents);
    const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
    const row = (account: string, debit: string, credit: string) =>
      [
        entry.id,
        entry.bookedOn,
        account,
        debit,
        credit,
        'EUR',
        entry.label,
        entry.sourceKind,
        entry.sourceId,
        entry.reversesId ?? '',
        entry.recordedAt,
        entry.recordedByUserId,
      ]
        .map(cell)
        .join(',');
    return [row(entry.debitAccount, amount, '0.00'), row(entry.creditAccount, '0.00', amount)];
  });
  return `\uFEFFentry_id,booked_on,account,debit,credit,currency,label,source_kind,source_id,reverses_id,recorded_at,recorded_by_user_id\r\n${rows.join('\r\n')}\r\n`;
};
