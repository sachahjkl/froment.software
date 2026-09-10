import { type ClientAccessValue, type QuoteSummaryValue } from '@froment/contracts';
import { formatMoney, translate, type Language } from '@froment/l10n';
import { type CsvCell } from '@shared/table-export/csv';
import { type WorkspaceTableOptions } from '../configuration/workspace-table';

export interface ClientDocument {
  readonly id: string;
  readonly type: 'quote' | 'order' | 'invoice';
  readonly kind: string;
  readonly reference: string;
  readonly title: string;
  readonly status: string;
  readonly totalCents: number;
  readonly link: readonly string[];
  readonly updatedAt: string;
}

export type ClientAffairRow = QuoteSummaryValue & { readonly position: number };
export type ClientAccessRow = ClientAccessValue & { readonly position: number };

export const clientAffairTableOptions: WorkspaceTableOptions<ClientAffairRow> = {
  columns: [
    { kind: 'number', key: 'position', value: (item) => item.position },
    { kind: 'text', key: 'reference', value: (item) => item.reference },
    {
      kind: 'text',
      key: 'status',
      value: (item, language) => translate(language, `backOffice.quote.status.${item.status}`),
    },
    { kind: 'number', key: 'amount', value: (item) => item.totalCents },
    { kind: 'number', key: 'date', value: (item) => Date.parse(item.updatedAt) },
  ],
  defaultSort: 'positionAsc',
  id: (item) => item.id,
  searchKeys: ['reference', 'title'],
  parameters: { q: 'clientAffairQ', sort: 'clientAffairSort', filter: 'clientAffairStatus' },
  filters: [
    { value: 'draft', label: 'backOffice.quote.status.draft' },
    { value: 'sent', label: 'backOffice.quote.status.sent' },
    { value: 'accepted', label: 'backOffice.quote.status.accepted' },
    { value: 'rejected', label: 'backOffice.quote.status.rejected' },
    { value: 'expired', label: 'backOffice.quote.status.expired' },
    { value: 'cancelled', label: 'backOffice.quote.status.cancelled' },
  ],
  matchesFilter: (item, filter) => item.status === filter,
};

export const clientDocumentTableOptions: WorkspaceTableOptions<ClientDocument> = {
  columns: [
    { kind: 'text', key: 'reference', value: (item) => item.reference },
    { kind: 'text', key: 'status', value: (item) => item.status },
    { kind: 'number', key: 'amount', value: (item) => item.totalCents },
    { kind: 'number', key: 'date', value: (item) => Date.parse(item.updatedAt) },
  ],
  defaultSort: 'dateDesc',
  id: (item) => item.id,
  searchKeys: ['reference', 'title'],
  parameters: { q: 'clientDocumentQ', sort: 'clientDocumentSort', filter: 'clientDocumentType' },
  filters: [
    { value: 'quote', label: 'backOffice.clientDetail.quote' },
    { value: 'order', label: 'backOffice.clientDetail.order' },
    { value: 'invoice', label: 'backOffice.clientDetail.invoice' },
  ],
  matchesFilter: (item, filter) => item.type === filter,
};

export const clientAccessTableOptions: WorkspaceTableOptions<ClientAccessRow> = {
  columns: [
    { kind: 'number', key: 'position', value: (item) => item.position },
    { kind: 'text', key: 'email', value: (item) => item.email },
    { kind: 'number', key: 'date', value: (item) => item.createdAt },
  ],
  defaultSort: 'positionAsc',
  id: (item) => item.id,
  searchKeys: ['email'],
  parameters: { q: 'clientAccessQ', sort: 'clientAccessSort', filter: 'clientAccessFilter' },
};

export function clientAffairExport(
  rows: readonly QuoteSummaryValue[],
  language: Language,
): readonly (readonly CsvCell[])[] {
  return rows.map((item) => [
    item.reference,
    item.title,
    translate(language, `backOffice.quote.status.${item.status}`),
    formatMoney(item.totalCents, language, 'EUR'),
    item.updatedAt,
  ]);
}

export function clientDocumentExport(
  rows: readonly ClientDocument[],
  language: Language,
): readonly (readonly CsvCell[])[] {
  return rows.map((item) => [
    item.kind,
    item.reference,
    item.title,
    item.status,
    formatMoney(item.totalCents, language, 'EUR'),
    item.updatedAt,
  ]);
}

export function clientAccessExport(
  rows: readonly ClientAccessValue[],
): readonly (readonly CsvCell[])[] {
  return rows.map((item) => [item.email, new Date(item.createdAt).toISOString()]);
}
