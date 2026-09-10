import { type ParamMap } from '@angular/router';
import {
  CalendarDate,
  type BankAllocation,
  type BankImportPreview,
  type BankMatchHistory,
  type BankTransactionValue,
  type LedgerJournalEntry,
  type LedgerSource,
} from '@froment/contracts';
import { Schema } from 'effect';
import { type I18nService, type TranslationKey } from '@app/i18n.service';
import { bankTableSort, type BankTableColumn } from './bank-table-sort';

export const bankStatuses = [
  'unmatched',
  'partial',
  'matched',
  'cancelledPayment',
  'notApplicable',
] as const;
export type BankStatus = (typeof bankStatuses)[number];
export const bankStatus = (transaction: BankTransactionValue): BankStatus => {
  if (transaction.amountCents < 0) return 'notApplicable';
  if (transaction.allocations.some((allocation) => allocation.paymentCancelled))
    return 'cancelledPayment';
  if (transaction.matchedCents === 0) return 'unmatched';
  return transaction.matchedCents < transaction.amountCents ? 'partial' : 'matched';
};
export const bankStatusLabel = (status: BankStatus): TranslationKey => `bankWorkspace.${status}`;
const bankStatusRank = {
  unmatched: 0,
  partial: 1,
  matched: 2,
  cancelledPayment: 3,
  notApplicable: 4,
} satisfies Record<BankStatus, number>;
export const ledgerSourceRank = { debit: 0, fee: 1 } as const;

export const bankColumns: readonly BankTableColumn<BankTransactionValue>[] = [
  {
    key: 'reference',
    label: 'bankWorkspace.reference',
    kind: 'text',
    value: (row) => row.reference,
  },
  {
    key: 'description',
    label: 'bankWorkspace.description',
    kind: 'text',
    value: (row) => row.description,
  },
  { key: 'account', label: 'bankWorkspace.account', kind: 'text', value: (row) => row.account },
  { key: 'date', label: 'bankWorkspace.date', kind: 'date', value: (row) => row.bookedOn },
  {
    key: 'status',
    label: 'bankWorkspace.status',
    kind: 'rank',
    value: (row) => bankStatusRank[bankStatus(row)],
  },
  { key: 'amount', label: 'bankWorkspace.amount', kind: 'number', value: (row) => row.amountCents },
];
export const previewColumns: readonly BankTableColumn<
  (typeof BankImportPreview.Type)['rows'][number]
>[] = [
  {
    key: 'reference',
    label: 'bankWorkspace.reference',
    kind: 'text',
    value: (row) => row.reference,
  },
  {
    key: 'description',
    label: 'bankWorkspace.description',
    kind: 'text',
    value: (row) => row.description,
  },
  { key: 'date', label: 'bankWorkspace.date', kind: 'date', value: (row) => row.bookedOn },
  { key: 'amount', label: 'bankWorkspace.amount', kind: 'number', value: (row) => row.amountCents },
  {
    key: 'status',
    label: 'bankWorkspace.preview',
    kind: 'rank',
    value: (row) => (row.existing ? 1 : 0),
  },
];
export const allocationColumns: readonly BankTableColumn<typeof BankAllocation.Type>[] = [
  { key: 'invoice', label: 'bank.invoice', kind: 'text', value: (row) => row.invoiceNumber ?? '' },
  { key: 'payment', label: 'bankWorkspace.payment', kind: 'text', value: (row) => row.paymentId },
  {
    key: 'amount',
    label: 'bank.allocationAmount',
    kind: 'number',
    value: (row) => row.amountCents,
  },
  { key: 'fee', label: 'bank.fees', kind: 'number', value: (row) => row.feeCents },
];
export const historyColumns: readonly BankTableColumn<(typeof BankMatchHistory.Type)[number]>[] = [
  { key: 'invoice', label: 'bank.invoice', kind: 'text', value: (row) => row.invoiceNumber ?? '' },
  { key: 'date', label: 'bank.matched', kind: 'date', value: (row) => row.matchedAt },
  {
    key: 'amount',
    label: 'bank.allocationAmount',
    kind: 'number',
    value: (row) => row.amountCents,
  },
  { key: 'fee', label: 'bank.fees', kind: 'number', value: (row) => row.feeCents },
  { key: 'cancelled', label: 'bank.unmatched', kind: 'date', value: (row) => row.cancelledAt },
];
export const ledgerSourceColumns: readonly BankTableColumn<typeof LedgerSource.Type>[] = [
  {
    key: 'reference',
    label: 'bankWorkspace.reference',
    kind: 'text',
    value: (row) => row.reference,
  },
  { key: 'account', label: 'bankWorkspace.account', kind: 'text', value: (row) => row.account },
  {
    key: 'sourceKind',
    label: 'bankWorkspace.sourceType',
    kind: 'rank',
    value: (row) => ledgerSourceRank[row.sourceKind],
  },
  { key: 'date', label: 'bankWorkspace.date', kind: 'date', value: (row) => row.bookedOn },
  { key: 'amount', label: 'bankWorkspace.amount', kind: 'number', value: (row) => row.amountCents },
];
export const ledgerEntryColumns: readonly BankTableColumn<typeof LedgerJournalEntry.Type>[] = [
  { key: 'label', label: 'ledger.label', kind: 'text', value: (row) => row.label },
  {
    key: 'reference',
    label: 'bankWorkspace.reference',
    kind: 'text',
    value: (row) => row.sourceReference,
  },
  { key: 'date', label: 'bankWorkspace.date', kind: 'date', value: (row) => row.bookedOn },
  {
    key: 'debitAccount',
    label: 'ledger.debitAccount',
    kind: 'text',
    value: (row) => row.debitAccount,
  },
  {
    key: 'creditAccount',
    label: 'ledger.creditAccount',
    kind: 'text',
    value: (row) => row.creditAccount,
  },
  {
    key: 'status',
    label: 'bankWorkspace.entryStatus',
    kind: 'rank',
    value: (row) => (row.reversesId ? 2 : row.reversalId ? 1 : 0),
  },
  { key: 'amount', label: 'bankWorkspace.amount', kind: 'number', value: (row) => row.amountCents },
];
export const bankQuery = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 120),
  account: (params.get('account') ?? '').slice(0, 100),
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  flow: params.get('flow') === 'credit' ? 'credit' : params.get('flow') === 'debit' ? 'debit' : '',
  status: Schema.is(Schema.Literals(bankStatuses))(params.get('status'))
    ? (params.get('status') ?? '')
    : '',
  sort: bankTableSort(params.get('sort'), bankColumns),
});
export const validBankPeriod = (from: string, to: string): boolean =>
  (from === '' || Schema.is(CalendarDate)(from)) &&
  (to === '' || Schema.is(CalendarDate)(to)) &&
  (from === '' || to === '' || from <= to);
export const bankTabs = (i18n: I18nService) => [
  {
    id: 'bank-transactions-tab',
    path: '/backoffice/banque',
    label: i18n.t('bankWorkspace.transactions'),
    exact: true,
  },
  {
    id: 'bank-entries-tab',
    path: '/backoffice/banque/ecritures',
    label: i18n.t('bankWorkspace.entries'),
  },
];
export const ledgerQuery = (params: ParamMap) => {
  const year = new Date().getFullYear();
  return {
    from: params.get('from') ?? `${year}-01-01`,
    to: params.get('to') ?? `${year}-12-31`,
    q: (params.get('q') ?? '').slice(0, 120),
    view: params.get('view') === 'journal' ? 'journal' : 'sources',
    sort:
      params.get('view') === 'journal'
        ? bankTableSort(params.get('sort'), ledgerEntryColumns)
        : bankTableSort(params.get('sort'), ledgerSourceColumns),
  };
};
export const ledgerSourceLink = (kind: string, id: string) => [
  '/backoffice/banque/ecritures/comptabiliser',
  kind,
  id,
];
export const ledgerEntryLink = (id: string) => ['/backoffice/banque/ecritures', id, 'contrepasser'];
export const transactionLink = (id: string) => ['/backoffice/banque/transactions', id];
