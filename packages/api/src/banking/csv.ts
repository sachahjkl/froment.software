import { BankImportInvalid, CalendarDate } from '@froment/contracts';
import { Schema } from 'effect';
import { parse } from 'csv-parse/sync';

const CsvRow = Schema.Struct({
  transaction_id: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
  booked_on: CalendarDate,
  amount: Schema.String.check(Schema.isPattern(/^-?\d+\.\d{2}$/)),
  currency: Schema.Literal('EUR'),
  description: Schema.String.check(Schema.isMaxLength(500)),
});

export const parseBankStatement = (csv: string) => {
  try {
    const rows = Schema.decodeUnknownSync(Schema.Array(CsvRow))(
      parse(csv, {
        bom: true,
        columns: (columns: string[]) => {
          const expected = ['transaction_id', 'booked_on', 'amount', 'currency', 'description'];
          if (
            columns.length !== expected.length ||
            !expected.every((column, index) => columns[index] === column)
          )
            throw new Error('bank.invalid_header');
          return columns;
        },
        skip_empty_lines: true,
        max_record_size: 10000,
      }),
    );
    if (rows.length === 0 || rows.length > 1000) throw new Error('bank.row_limit');
    const references = new Set<string>();
    return rows.map((row) => {
      const cents = BigInt(row.amount.replace('.', ''));
      if (
        cents === 0n ||
        cents > BigInt(Number.MAX_SAFE_INTEGER) ||
        cents < BigInt(Number.MIN_SAFE_INTEGER) ||
        references.has(row.transaction_id)
      )
        throw new Error('bank.invalid_row');
      references.add(row.transaction_id);
      return {
        reference: row.transaction_id,
        bookedOn: row.booked_on,
        amountCents: Number(cents),
        description: row.description,
      };
    });
  } catch {
    throw new BankImportInvalid({ code: 'bank.import_invalid' });
  }
};
