import { describe, expect, it } from 'vitest';
import { DefaultBankCsvConfiguration } from '@froment/contracts';
import { parseBankStatement } from './statement.js';

const header = 'transaction_id,booked_on,amount,currency,description\r\n';
const csv = (content: string) => ({
  account: 'Main',
  format: 'csv' as const,
  content,
  csvConfiguration: DefaultBankCsvConfiguration,
});
describe('bank CSV import', () => {
  it('parses BOM, quoted commas, escaped quotes, negative amounts and multiline descriptions', () => {
    expect(
      parseBankStatement(
        csv(
          `\uFEFF${header}BANK-1,2026-09-01,1250.01,EUR,"Client, ""A"""\r\nBANK-2,2026-09-02,-0.01,EUR,"Fee\nDetails"`,
        ),
      ),
    ).toEqual([
      {
        reference: 'BANK-1',
        bookedOn: '2026-09-01',
        amountCents: 125001,
        currency: 'EUR',
        description: 'Client, "A"',
      },
      {
        reference: 'BANK-2',
        bookedOn: '2026-09-02',
        amountCents: -1,
        currency: 'EUR',
        description: 'Fee\nDetails',
      },
    ]);
  });
  it.each([
    'BANK-1,2026-02-30,10.00,EUR,Invalid date',
    'BANK-1,2026-09-01,0.00,EUR,Zero',
    'BANK-1,2026-09-01,90071992547409.92,EUR,Overflow',
    'BANK-1,2026-09-01,1.001,EUR,Precision',
    'BANK-1,2026-09-01,1.00,euro,Currency',
    'BANK-1,2026-09-01,1.00,EUR,"Unclosed',
    'BANK-1,2026-09-01,1.00,EUR,First\nBANK-1,2026-09-01,1.00,EUR,Second',
  ])('rejects invalid input without producing partial rows', (input) => {
    expect(() => parseBankStatement(csv(header + input))).toThrow();
  });
  it('rejects extra columns, empty files and oversized imports', () => {
    expect(() => parseBankStatement(csv(header))).toThrow();
    expect(() => parseBankStatement(csv('transaction_id,transaction_id\nA,B'))).toThrow();
    expect(() =>
      parseBankStatement(
        csv(
          header +
            Array.from({ length: 1001 }, (_, index) => `${index},2026-09-01,1.00,EUR,Test`).join(
              '\n',
            ),
        ),
      ),
    ).toThrow();
  });
});

it('parses configurable CSV columns and European number formats', () => {
  expect(
    parseBankStatement({
      account: 'Main',
      format: 'csv',
      content: 'Référence;Date;Montant;Libellé\nFR-1;12/09/2026;125,01;Règlement',
      csvConfiguration: {
        delimiter: ';',
        referenceColumn: 'Référence',
        bookedOnColumn: 'Date',
        amountColumn: 'Montant',
        currencyColumn: '',
        descriptionColumn: 'Libellé',
        dateFormat: 'dd/MM/yyyy',
        decimalSeparator: ',',
      },
    }),
  ).toEqual([
    {
      reference: 'FR-1',
      bookedOn: '2026-09-12',
      amountCents: 12_501,
      currency: 'EUR',
      description: 'Règlement',
    },
  ]);
});

it('parses CAMT.053 and OFX statements', () => {
  const camt = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><Stmt><Id>STMT-1</Id><Acct><Ccy>EUR</Ccy></Acct><Ntry><Amt Ccy="EUR">12.50</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-09-12</Dt></BookgDt><NtryRef>CAMT-1</NtryRef><AddtlNtryInf>Transfer</AddtlNtryInf></Ntry></Stmt></BkToCstmrStmt></Document>`;
  expect(
    parseBankStatement({
      account: 'Main',
      format: 'camt.053',
      content: camt,
      csvConfiguration: null,
    }),
  ).toEqual([
    {
      reference: 'CAMT-1',
      bookedOn: '2026-09-12',
      amountCents: 1_250,
      currency: 'EUR',
      description: 'Transfer',
    },
  ]);
  const ofx = `OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR<BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260912120000<TRNAMT>-4.20<FITID>OFX-1<NAME>Bank fee<MEMO>Monthly</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  expect(
    parseBankStatement({ account: 'Main', format: 'ofx', content: ofx, csvConfiguration: null }),
  ).toEqual([
    {
      reference: 'OFX-1',
      bookedOn: '2026-09-12',
      amountCents: -420,
      currency: 'EUR',
      description: 'Bank fee — Monthly',
    },
  ]);
});
