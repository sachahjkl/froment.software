import { describe, expect, it } from 'vitest';
import { parseBankStatement } from './csv.js';

const header = 'transaction_id,booked_on,amount,currency,description\r\n';
describe('bank CSV import', () => {
  it('parses BOM, quoted commas, escaped quotes, negative amounts and multiline descriptions', () => {
    expect(
      parseBankStatement(
        `\uFEFF${header}BANK-1,2026-09-01,1250.01,EUR,"Client, ""A"""\r\nBANK-2,2026-09-02,-0.01,EUR,"Fee\nDetails"`,
      ),
    ).toEqual([
      {
        reference: 'BANK-1',
        bookedOn: '2026-09-01',
        amountCents: 125001,
        description: 'Client, "A"',
      },
      { reference: 'BANK-2', bookedOn: '2026-09-02', amountCents: -1, description: 'Fee\nDetails' },
    ]);
  });
  it.each([
    'BANK-1,2026-02-30,10.00,EUR,Invalid date',
    'BANK-1,2026-09-01,0.00,EUR,Zero',
    'BANK-1,2026-09-01,90071992547409.92,EUR,Overflow',
    'BANK-1,2026-09-01,1.001,EUR,Precision',
    'BANK-1,2026-09-01,1.00,USD,Currency',
    'BANK-1,2026-09-01,1.00,EUR,"Unclosed',
    'BANK-1,2026-09-01,1.00,EUR,First\nBANK-1,2026-09-01,1.00,EUR,Second',
  ])('rejects invalid input without producing partial rows', (input) => {
    expect(() => parseBankStatement(header + input)).toThrow();
  });
  it('rejects extra columns, empty files and oversized imports', () => {
    expect(() => parseBankStatement(header)).toThrow();
    expect(() => parseBankStatement('transaction_id,transaction_id\nA,B')).toThrow();
    expect(() =>
      parseBankStatement(
        header +
          Array.from({ length: 1001 }, (_, index) => `${index},2026-09-01,1.00,EUR,Test`).join(
            '\n',
          ),
      ),
    ).toThrow();
  });
});
