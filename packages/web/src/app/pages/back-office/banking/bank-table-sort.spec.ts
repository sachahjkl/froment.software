import { convertToParamMap } from '@angular/router';
import { bankSortDirection, bankTableSort, compareBankRows, nextBankSort } from './bank-table-sort';
import {
  allocationColumns,
  bankColumns,
  bankQuery,
  bankQueryParams,
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
    for (const sort of [null, '', 'none', 'amount', 'amount-up', 'constructor-asc', 'label-desc']) {
      expect(bankQuery(convertToParamMap({ sort })).sort).toBe('none');
    }
    expect(bankQuery(convertToParamMap({})).sort).toBe('none');
    expect(ledgerQuery(convertToParamMap({})).sort).toBe('none');
    expect(ledgerQuery(convertToParamMap({ view: 'journal' })).sort).toBe('none');
    expect(bankQuery(convertToParamMap({ sort: 'amount-asc' })).sort).toBe('amount-asc');
    expect(ledgerQuery(convertToParamMap({ sort: 'label-desc' })).sort).toBe('none');
    expect(ledgerQuery(convertToParamMap({ view: 'journal', sort: 'label-desc' })).sort).toBe(
      'label-desc',
    );
    expect(bankTableSort('account-asc', previewColumns)).toBe('none');
    expect(bankTableSort('date-desc', allocationColumns)).toBe('none');
    expect(bankTableSort(null, historyColumns)).toBe('none');
    expect(bankTableSort('unknown-desc', historyColumns)).toBe('none');
  });
  it('cycles from ascending to descending to none and starts another column ascending', () => {
    for (const column of ['date', 'amount', 'invoice', 'cancelled', 'sourceKind']) {
      const ascending = nextBankSort('none', column);
      const descending = nextBankSort(ascending, column);
      const reset = nextBankSort(descending, column);
      expect(ascending).toBe(`${column}-asc`);
      expect(descending).toBe(`${column}-desc`);
      expect(reset).toBe('none');
      expect(bankSortDirection(reset, column)).toBe('none');
      expect(nextBankSort(reset, column)).toBe(ascending);
      expect(nextBankSort('reference-desc', column)).toBe(ascending);
      expect(nextBankSort('invalid', column)).toBe(ascending);
    }
  });
  it('serializes none as a removed sort parameter without changing filters or independent sorts', () => {
    const query = {
      ...bankQuery(convertToParamMap({ q: 'reglement', account: 'MAIN', flow: 'credit' })),
      historySort: 'date-desc',
    };
    expect(bankQueryParams(query)).toEqual({ ...query, sort: null });
    expect(query.sort).toBe('none');
    expect(bankQueryParams({ ...query, sort: 'amount-desc' })).toEqual({
      ...query,
      sort: 'amount-desc',
    });
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
    for (const sort of ['date-desc', 'none']) {
      expect(
        rows
          .toSorted(compareBankRows(sort, bankColumns, 'fr', (row) => row.id))
          .map((row) => row.id),
      ).toEqual(['A', 'C', 'B']);
    }
    expect(rows.map((row) => row.id)).toEqual(['C', 'A', 'B']);
  });
  it('restores ascending invoice order for allocations with stable ties and immutable input', () => {
    const allocation = {
      matchId: 'C',
      paymentId: bankId,
      invoiceId: bankId,
      invoiceNumber: 'FA-10',
      amountCents: 900,
      feeCents: 0,
      exchangeDifferenceFunctionalCents: 0,
      paymentCancelled: false,
    };
    const rows = Object.freeze([
      allocation,
      { ...allocation, matchId: 'B', invoiceNumber: 'FA-2' },
      { ...allocation, matchId: 'A', invoiceNumber: 'FA-2' },
    ]);
    expect(
      rows
        .toSorted(
          compareBankRows('none', allocationColumns, 'fr', (row) => row.matchId, 'invoice-asc'),
        )
        .map((row) => row.matchId),
    ).toEqual(['A', 'B', 'C']);
    expect(rows.map((row) => row.matchId)).toEqual(['C', 'B', 'A']);
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
    for (const sort of ['amount-asc', 'amount-desc', 'none']) {
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
