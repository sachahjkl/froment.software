import { describe, expect, it } from 'vitest';
import { paymentExportCsv, type PaymentExportRow } from './payment-export.js';

const row: PaymentExportRow = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  requestId: '8a476442-20ae-4a53-88f4-18762e7a1100',
  expectedVersion: 2,
  invoiceNumber: 'FA-2026-000001',
  clientName: 'Client',
  amountCents: 12345,
  currency: 'EUR',
  paidOn: '2026-09-05',
  method: 'transfer',
  reference: 'BANK-123',
  recordedAt: '2026-09-05T12:00:00.000Z',
  recordedByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
};

describe('payment CSV export', () => {
  it('writes UTF-8 BOM, stable columns and exact monetary decimals', () => {
    const csv = paymentExportCsv([row, { ...row, amountCents: Number.MAX_SAFE_INTEGER }]);
    expect(
      csv.startsWith(
        '\uFEFFpayment_id,invoice_number,client_name,amount,currency,paid_on,method,reference,recorded_at,recorded_by_user_id\r\n',
      ),
    ).toBe(true);
    expect(csv).toContain('"123.45","EUR"');
    expect(csv).toContain('"90071992547409.91","EUR"');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('quotes commas, double quotes and newlines without changing the source', () => {
    const special = { ...row, clientName: 'A, "B"', reference: 'Line 1\nLine 2' };
    const csv = paymentExportCsv([special]);
    expect(csv).toContain('"A, ""B"""');
    expect(csv).toContain('"Line 1\nLine 2"');
    expect(special.clientName).toBe('A, "B"');
  });
  it.each(['=1+1', '+123', '-123', '@SUM(A1)', '\t=1+1', '\r\n=1+1'])(
    'neutralizes spreadsheet formulas in %j',
    (reference) => {
      expect(paymentExportCsv([{ ...row, reference }])).toContain(`"'${reference}"`);
    },
  );
  it('exports a header without inventing records for an empty period', () => {
    expect(paymentExportCsv([]).split('\r\n')).toHaveLength(2);
  });
});
