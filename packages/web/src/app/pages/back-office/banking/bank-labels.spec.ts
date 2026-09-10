import { ledgerEntryStatusLabel, ledgerSourceLabel } from './bank-workspace';

describe('Ledger labels', () => {
  it.each([
    ['debit', 'ledger.debit'],
    ['fee', 'ledger.fee'],
  ] as const)('labels the %s source', (kind, label) => {
    expect(ledgerSourceLabel(kind)).toBe(label);
  });

  it.each([
    [{ reversesId: null, reversalId: null }, 'bankWorkspace.activeEntry'],
    [{ reversesId: null, reversalId: 'reversal' }, 'bankWorkspace.reversedEntry'],
    [{ reversesId: 'original', reversalId: null }, 'bankWorkspace.reversalEntry'],
  ] as const)('labels the recorded entry state %j', (entry, label) => {
    expect(ledgerEntryStatusLabel(entry)).toBe(label);
  });
});
