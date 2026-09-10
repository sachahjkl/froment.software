import { convertToParamMap } from '@angular/router';
import { bankTableSort, compareBankRows } from './bank-table-sort';
import {
  allocationColumns,
  bankColumns,
  bankQuery,
  historyColumns,
  ledgerEntryColumns,
  ledgerQuery,
  ledgerSourceColumns,
  previewColumns,
} from './bank-workspace';
import {
  bankHistory,
  bankId,
  bankTransaction,
  ledgerEntry,
  ledgerSource,
  otherBankId,
} from './bank-workspace.spec-helper';

describe('Bank table sorting', () => {
  it('accepts only known columns and directions for each table', () => {
    for (const sort of [null, 'amount', 'amount-up', 'constructor-asc', 'label-desc']) {
      expect(bankQuery(convertToParamMap({ sort })).sort).toBe('date-desc');
    }
    expect(bankQuery(convertToParamMap({ sort: 'amount-asc' })).sort).toBe('amount-asc');
    expect(ledgerQuery(convertToParamMap({ sort: 'label-desc' })).sort).toBe('date-desc');
    expect(ledgerQuery(convertToParamMap({ view: 'journal', sort: 'label-desc' })).sort).toBe(
      'label-desc',
    );
    expect(bankTableSort('account-asc', previewColumns)).toBe('date-desc');
    expect(bankTableSort('date-desc', allocationColumns, 'invoice-asc')).toBe('invoice-asc');
  });
  it('sorts signed cents numerically and calendar dates chronologically without changing the input', () => {
    const rows = [
      { ...bankTransaction, id: 'C', amountCents: 900, bookedOn: '2026-12-31' },
      { ...bankTransaction, id: 'A', amountCents: -10000, bookedOn: '2027-01-01' },
      { ...bankTransaction, id: 'B', amountCents: 10000, bookedOn: '2026-02-01' },
    ];
    expect(
      rows
        .toSorted(compareBankRows('amount-asc', bankColumns, 'fr', (row) => row.id))
        .map((row) => row.id),
    ).toEqual(['A', 'C', 'B']);
    expect(
      rows
        .toSorted(compareBankRows('date-desc', bankColumns, 'fr', (row) => row.id))
        .map((row) => row.id),
    ).toEqual(['A', 'C', 'B']);
    expect(rows.map((row) => row.id)).toEqual(['C', 'A', 'B']);
  });
  it('uses the current language collator and ascending stable identifiers for ties', () => {
    const rows = [
      { ...bankTransaction, id: 'B', description: 'ä' },
      { ...bankTransaction, id: 'A', description: 'z' },
    ];
    expect(
      rows.toSorted(compareBankRows('description-asc', bankColumns, 'fr', (row) => row.id))[0]?.id,
    ).toBe('B');
    expect(
      rows.toSorted(compareBankRows('description-asc', bankColumns, 'sv', (row) => row.id))[0]?.id,
    ).toBe('A');
    const references = rows.map((row, index) => ({
      ...row,
      reference: index ? 'BANK-2' : 'BANK-10',
    }));
    expect(
      references.toSorted(compareBankRows('reference-asc', bankColumns, 'fr', (row) => row.id))[0]
        ?.reference,
    ).toBe('BANK-2');
    for (const sort of ['amount-asc', 'amount-desc']) {
      expect(
        rows
          .toSorted(compareBankRows(sort, bankColumns, 'fr', (row) => row.id))
          .map((row) => row.id),
      ).toEqual(['A', 'B']);
    }
  });
  it('uses explicit debit and fee ranks rather than translated labels', () => {
    const rows = [{ ...ledgerSource, sourceKind: 'fee' as const }, ledgerSource];
    for (const language of ['fr', 'en']) {
      expect(
        rows
          .toSorted(
            compareBankRows(
              'sourceKind-asc',
              ledgerSourceColumns,
              language,
              (row) => `${row.sourceId}/${row.sourceKind}`,
            ),
          )
          .map((row) => row.sourceKind),
      ).toEqual(['debit', 'fee']);
    }
    const entries = [
      { ...ledgerEntry, id: 'C', sourceReference: 'BANK', reversesId: bankId },
      { ...ledgerEntry, id: 'B', sourceReference: 'BANK', reversalId: otherBankId },
      { ...ledgerEntry, id: 'A', sourceReference: 'BANK' },
    ];
    expect(
      entries
        .toSorted(compareBankRows('status-asc', ledgerEntryColumns, 'fr', (row) => row.id))
        .map((row) => row.id),
    ).toEqual(['A', 'B', 'C']);
  });
  it('orders history timestamps and keeps missing cancellation dates last in either direction', () => {
    const first = bankHistory[0];
    if (!first) throw new Error('bank.test.history_missing');
    const rows = [
      { ...first, id: 'A', matchedAt: '2026-09-01T12:00:00Z', cancelledAt: null },
      { ...first, id: 'B', matchedAt: '2026-09-01T12:00:00.001Z' },
    ];
    expect(
      rows
        .toSorted(compareBankRows('date-asc', historyColumns, 'fr', (row) => row.id))
        .map((row) => row.id),
    ).toEqual(['A', 'B']);
    for (const sort of ['cancelled-asc', 'cancelled-desc']) {
      expect(
        rows
          .toSorted(compareBankRows(sort, historyColumns, 'fr', (row) => row.id))
          .map((row) => row.id),
      ).toEqual(['B', 'A']);
    }
  });
});
