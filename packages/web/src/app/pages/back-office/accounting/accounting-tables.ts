import type {
  AccountingAccount,
  AccountingBalanceReport,
  AccountingEntry,
  AccountingEvidence,
  AccountingJournal,
  AccountingLedgerReport,
  AccountingLetterableLine,
  AccountingPeriod,
} from '@froment/contracts';
import type { WorkspaceTableOptions } from '../configuration/workspace-table';

export const accountTableOptions: WorkspaceTableOptions<AccountingAccount> = {
  columns: [
    { kind: 'text', key: 'code', value: (item) => item.code },
    { kind: 'text', key: 'label', value: (item) => item.label },
  ],
  defaultSort: 'codeAsc',
  id: (item) => item.id,
  searchKeys: ['code', 'label'],
  parameters: { q: 'accountQ', sort: 'accountSort', filter: 'accountFilter' },
  filters: [
    { value: 'active', label: 'accounting.active' },
    { value: 'archived', label: 'accounting.archived' },
  ],
  matchesFilter: (item, filter) => item.archived === (filter === 'archived'),
};

export const journalTableOptions: WorkspaceTableOptions<AccountingJournal> = {
  columns: [
    { kind: 'text', key: 'code', value: (item) => item.code },
    { kind: 'text', key: 'label', value: (item) => item.label },
  ],
  defaultSort: 'codeAsc',
  id: (item) => item.id,
  searchKeys: ['code', 'label'],
  parameters: { q: 'journalQ', sort: 'journalSort', filter: 'journalFilter' },
  filters: [
    { value: 'active', label: 'accounting.active' },
    { value: 'archived', label: 'accounting.archived' },
  ],
  matchesFilter: (item, filter) => item.archived === (filter === 'archived'),
};

export const periodTableOptions: WorkspaceTableOptions<AccountingPeriod> = {
  columns: [
    { kind: 'text', key: 'startsOn', value: (item) => item.startsOn },
    { kind: 'text', key: 'label', value: (item) => item.label },
  ],
  defaultSort: 'startsOnDesc',
  id: (item) => item.id,
  searchKeys: ['label', 'startsOn', 'endsOn'],
  parameters: { q: 'periodQ', sort: 'periodSort', filter: 'periodFilter' },
  filters: [
    { value: 'open', label: 'accounting.period.open' },
    { value: 'locked', label: 'accounting.period.locked' },
    { value: 'closed', label: 'accounting.period.closed' },
    { value: 'final', label: 'accounting.period.final' },
  ],
  matchesFilter: (item, filter) =>
    filter === 'final' ? item.finalClosed : item.status === filter && !item.finalClosed,
};

export const entryTableOptions: WorkspaceTableOptions<AccountingEntry> = {
  columns: [
    { kind: 'text', key: 'date', value: (item) => item.entryDate },
    { kind: 'text', key: 'reference', value: (item) => item.reference },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['reference', 'description', 'entryDate'],
  parameters: { q: 'entryQ', sort: 'entrySort', filter: 'entryFilter' },
  filters: [
    { value: 'draft', label: 'accounting.entry.draft' },
    { value: 'posted', label: 'accounting.entry.posted' },
    { value: 'reversed', label: 'accounting.entry.reversed' },
  ],
  matchesFilter: (item, filter) => item.status === filter,
};

export const letteringTableOptions: WorkspaceTableOptions<AccountingLetterableLine> = {
  columns: [
    { kind: 'text', key: 'date', value: (item) => item.entryDate },
    { kind: 'text', key: 'reference', value: (item) => item.reference },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.lineId,
  searchKeys: ['reference', 'accountCode', 'lineLabel', 'letteringCode'],
  parameters: { q: 'letteringQ', sort: 'letteringSort', filter: 'letteringFilter' },
  filters: [
    { value: 'pending', label: 'accounting.lettering.pending' },
    { value: 'completed', label: 'accounting.lettering.completed' },
  ],
  matchesFilter: (item, filter) => (item.letteringCode === null) === (filter === 'pending'),
};

export const evidenceTableOptions: WorkspaceTableOptions<AccountingEvidence> = {
  columns: [{ kind: 'text', key: 'file', value: (item) => item.fileName }],
  defaultSort: 'fileAsc',
  id: (item) => item.id,
  searchKeys: ['fileName', 'entryId', 'mediaType', 'sha256'],
  parameters: { q: 'evidenceQ', sort: 'evidenceSort', filter: 'evidenceFilter' },
  filters: [
    { value: 'pdf', label: 'accounting.evidence.pdf' },
    { value: 'image', label: 'accounting.evidence.image' },
    { value: 'other', label: 'accounting.evidence.other' },
  ],
  matchesFilter: (item, filter) => {
    if (filter === 'pdf') return item.mediaType === 'application/pdf';
    if (filter === 'image') return item.mediaType.startsWith('image/');
    return item.mediaType !== 'application/pdf' && !item.mediaType.startsWith('image/');
  },
};

type BalanceRow = AccountingBalanceReport['rows'][number];
export const balanceTableOptions: WorkspaceTableOptions<BalanceRow> = {
  columns: [{ kind: 'text', key: 'account', value: (item) => item.accountCode }],
  defaultSort: 'accountAsc',
  id: (item) => item.accountCode,
  searchKeys: ['accountCode', 'accountLabel'],
  parameters: { q: 'balanceQ', sort: 'balanceSort', filter: 'balanceFilter' },
  filters: [
    { value: 'debit', label: 'accounting.debit' },
    { value: 'credit', label: 'accounting.credit' },
    { value: 'balanced', label: 'accounting.balance.zero' },
  ],
  matchesFilter: (item, filter) =>
    filter === 'debit'
      ? item.balanceCents > 0
      : filter === 'credit'
        ? item.balanceCents < 0
        : item.balanceCents === 0,
};

type LedgerRow = AccountingLedgerReport['rows'][number];
export const ledgerTableOptions: WorkspaceTableOptions<LedgerRow> = {
  columns: [
    { kind: 'text', key: 'date', value: (item) => item.entryDate },
    { kind: 'text', key: 'reference', value: (item) => item.reference },
  ],
  defaultSort: 'dateDesc',
  id: (item) => `${item.entryId}:${item.accountCode}:${item.lineLabel}`,
  searchKeys: [
    'journalCode',
    'reference',
    'description',
    'accountCode',
    'accountLabel',
    'lineLabel',
  ],
  parameters: { q: 'ledgerQ', sort: 'ledgerSort', filter: 'ledgerFilter' },
  filters: [
    { value: 'debit', label: 'accounting.debit' },
    { value: 'credit', label: 'accounting.credit' },
  ],
  matchesFilter: (item, filter) =>
    filter === 'debit' ? item.debitCents > 0 : item.creditCents > 0,
};
