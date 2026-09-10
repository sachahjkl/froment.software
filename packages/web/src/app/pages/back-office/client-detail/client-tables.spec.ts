import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { serializeCsv } from '@shared/table-export/csv';
import {
  createWorkspaceTable,
  sortWorkspaceRows,
  workspaceTableParams,
  workspaceTableQuery,
  type WorkspaceTableOptions,
} from '../configuration/workspace-table';
import {
  clientAccessExport,
  clientAccessTableOptions,
  clientAffairExport,
  clientAffairTableOptions,
  clientDocumentExport,
  clientDocumentTableOptions,
  type ClientAccessRow,
  type ClientAffairRow,
  type ClientDocument,
} from './client-tables';

const affairs: readonly ClientAffairRow[] = [
  {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    clientDisplayName: 'Acme',
    reference: 'DEV-2026-0010',
    title: 'Étage 10',
    status: 'accepted',
    version: 1,
    currency: 'EUR',
    totalCents: 9007199254740991,
    updatedAt: '2026-09-01T22:00:00.001Z',
    position: 0,
  },
  {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    clientDisplayName: 'Acme',
    reference: 'DEV-2026-0002',
    title: 'Étage 2',
    status: 'draft',
    version: 1,
    currency: 'EUR',
    totalCents: 9007199254740990,
    updatedAt: '2026-09-01T22:00:00.000Z',
    position: 1,
  },
];
const documents: readonly ClientDocument[] = [
  {
    id: 'quote-b',
    type: 'quote',
    kind: 'Devis',
    reference: 'DEV-2026-0010',
    title: 'Étage 10',
    status: 'Accepté',
    totalCents: 100,
    link: ['/backoffice/quotes', 'quote-b'],
    updatedAt: '2026-08-31T23:00:00.000Z',
  },
  {
    id: 'invoice-c',
    type: 'invoice',
    kind: 'Facture',
    reference: 'FAC-2026-0002',
    title: 'Étage 2',
    status: 'Brouillon',
    totalCents: -20,
    link: ['/backoffice/invoices', 'invoice-c'],
    updatedAt: '2026-09-01T00:00:00.001Z',
  },
  {
    id: 'order-a',
    type: 'order',
    kind: 'Commande',
    reference: 'CMD-2026-0001',
    title: 'Support',
    status: 'Confirmée',
    totalCents: 0,
    link: ['/backoffice/orders', 'order-a'],
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
];
const accesses: readonly ClientAccessRow[] = [
  {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    email: 'z@example.test',
    createdAt: 1_700_000_000_001,
    position: 0,
  },
  {
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    email: 'a@example.test',
    createdAt: 1_700_000_000_000,
    position: 1,
  },
];

function sorted<Item>(items: readonly Item[], options: WorkspaceTableOptions<Item>, sort: string) {
  return sortWorkspaceRows(
    items.map((item, refIndex) => ({ item, refIndex })),
    options,
    sort,
    'fr',
  ).map(({ item }) => options.id(item));
}

describe('Client table queries', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the three table queries separate from the client list context', () => {
    const params = convertToParamMap({
      q: 'Acme',
      view: 'archived',
      country: 'France',
      contact: 'incomplete',
      sort: 'name-desc',
      clientAffairQ: 'Étage',
      clientAffairSort: 'amountDesc',
      clientAffairStatus: 'accepted',
      clientDocumentQ: 'FAC',
      clientDocumentSort: 'dateAsc',
      clientDocumentType: 'invoice',
      clientAccessQ: 'portal',
      clientAccessSort: 'emailDesc',
      clientAccessFrom: '2026-09-01',
      clientAccessTo: '2026-09-30',
    });
    expect(workspaceTableQuery(params, clientAffairTableOptions)).toEqual({
      q: 'Étage',
      sort: 'amountDesc',
      filter: 'accepted',
    });
    expect(workspaceTableQuery(params, clientDocumentTableOptions)).toEqual({
      q: 'FAC',
      sort: 'dateAsc',
      filter: 'invoice',
    });
    expect(workspaceTableQuery(params, clientAccessTableOptions)).toEqual({
      q: 'portal',
      sort: 'emailDesc',
      filter: 'all',
    });
    expect(
      workspaceTableParams(
        workspaceTableQuery(params, clientAccessTableOptions),
        clientAccessTableOptions,
      ),
    ).toEqual({ clientAccessQ: 'portal', clientAccessSort: 'emailDesc' });
  });

  it('rejects repeated, unsupported and overlong table query values', () => {
    const params = convertToParamMap({
      clientAffairQ: ['one', 'two'],
      clientAffairStatus: 'invoiced',
      clientAffairSort: 'secretDesc',
      clientDocumentQ: 'x'.repeat(121),
      clientDocumentType: ['invoice', 'quote'],
      clientDocumentSort: 'unknown',
      clientAccessQ: ['one', 'two'],
      clientAccessSort: ['emailAsc', 'emailDesc'],
      clientAccessFilter: 'revoked',
    });
    expect(workspaceTableQuery(params, clientAffairTableOptions)).toEqual({
      q: '',
      sort: 'none',
      filter: 'all',
    });
    expect(workspaceTableQuery(params, clientDocumentTableOptions)).toEqual({
      q: '',
      sort: 'none',
      filter: 'all',
    });
    expect(workspaceTableQuery(params, clientAccessTableOptions)).toEqual({
      q: '',
      sort: 'none',
      filter: 'all',
    });
  });

  it('searches references and accented titles while applying only the selected document type', () => {
    const queryParamMap = new BehaviorSubject(
      convertToParamMap({ clientDocumentQ: 'Etge', clientDocumentType: 'invoice' }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap } }],
    });
    const table = TestBed.runInInjectionContext(() =>
      createWorkspaceTable(signal(documents), clientDocumentTableOptions),
    );
    expect(table.rows().map(({ id }) => id)).toEqual(['invoice-c']);
    expect(table.match(table.results()[0]!, 'title').length).toBeGreaterThan(0);
    queryParamMap.next(
      convertToParamMap({ clientDocumentQ: 'CMD-2026-0001', clientDocumentType: 'order' }),
    );
    expect(table.rows().map(({ id }) => id)).toEqual(['order-a']);
  });

  it('uses quote statuses without adding access statuses or permissions', () => {
    expect(
      affairs.filter((item) => clientAffairTableOptions.matchesFilter?.(item, 'accepted')),
    ).toEqual([affairs[0]]);
    expect(clientAccessTableOptions.filters).toBeUndefined();
    expect(clientAccessTableOptions.searchKeys).toEqual(['email']);
  });

  it('cycles sorts and removes chips without clearing the other table parameters', () => {
    const context = {
      q: 'Acme',
      view: 'archived',
      country: 'France',
      contact: 'incomplete',
      sort: 'name-desc',
      clientAffairQ: 'Étage',
      clientDocumentType: 'invoice',
      clientDocumentSort: 'dateAsc',
      clientAccessQ: 'example',
      clientAccessFrom: '2026-09-01',
    };
    const queryParamMap = new BehaviorSubject(convertToParamMap(context));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap } }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const table = TestBed.runInInjectionContext(() =>
      createWorkspaceTable(signal(accesses), clientAccessTableOptions),
    );
    for (const [current, next] of [
      ['none', 'emailAsc'],
      ['emailAsc', 'emailDesc'],
      ['emailDesc', null],
    ] as const) {
      queryParamMap.next(convertToParamMap({ ...context, clientAccessSort: current }));
      table.sort('email');
      expect(navigate).toHaveBeenLastCalledWith(
        [],
        expect.objectContaining({
          queryParams: {
            clientAccessQ: 'example',
            clientAccessSort: next,
            clientAccessFilter: null,
          },
          queryParamsHandling: 'merge',
        }),
      );
    }
    queryParamMap.next(convertToParamMap(context));
    table.search('');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { clientAccessQ: null, clientAccessSort: null, clientAccessFilter: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });
});

describe('Client table ordering', () => {
  it('restores the source order for affairs and access accounts and newest dates for documents', () => {
    expect(sorted(affairs, clientAffairTableOptions, 'none')).toEqual(affairs.map(({ id }) => id));
    expect(sorted(accesses, clientAccessTableOptions, 'none')).toEqual(
      accesses.map(({ id }) => id),
    );
    expect(sorted(documents, clientDocumentTableOptions, 'none')).toEqual([
      'invoice-c',
      'order-a',
      'quote-b',
    ]);
    expect(sorted(documents, clientDocumentTableOptions, 'dateAsc')).toEqual([
      'quote-b',
      'order-a',
      'invoice-c',
    ]);
  });

  it('compares raw cents and timestamps without losing a cent or a millisecond', () => {
    expect(sorted(affairs, clientAffairTableOptions, 'amountAsc')).toEqual([
      affairs[1]!.id,
      affairs[0]!.id,
    ]);
    expect(sorted(affairs, clientAffairTableOptions, 'dateAsc')).toEqual([
      affairs[1]!.id,
      affairs[0]!.id,
    ]);
    expect(sorted(documents, clientDocumentTableOptions, 'amountAsc')).toEqual([
      'invoice-c',
      'order-a',
      'quote-b',
    ]);
    expect(sorted(accesses, clientAccessTableOptions, 'dateAsc')).toEqual([
      accesses[1]!.id,
      accesses[0]!.id,
    ]);
  });

  it('uses stable identifiers for ties in both directions', () => {
    const tied = accesses.map((item) => ({ ...item, email: 'same@example.test' }));
    const expected = [accesses[1]!.id, accesses[0]!.id];
    expect(sorted(tied, clientAccessTableOptions, 'emailAsc')).toEqual(expected);
    expect(sorted(tied.toReversed(), clientAccessTableOptions, 'emailDesc')).toEqual(expected);
  });
});

describe('Client table exports', () => {
  it('exports exact amounts and timestamps with explicit columns', () => {
    expect(clientAffairExport(affairs, 'en')[0]).toEqual([
      'DEV-2026-0010',
      'Étage 10',
      'Accepted',
      '€90,071,992,547,409.91',
      '2026-09-01T22:00:00.001Z',
    ]);
    expect(clientDocumentExport(documents, 'en')[1]).toEqual([
      'Facture',
      'FAC-2026-0002',
      'Étage 2',
      'Brouillon',
      '-€0.20',
      '2026-09-01T00:00:00.001Z',
    ]);
  });

  it('exports only visible fields and never includes document links or access secrets', () => {
    const secretAccess = {
      ...accesses[0]!,
      url: 'https://example.test/secret-link',
      token: 'secret-token',
      password: 'secret-password',
    };
    const accessRows = clientAccessExport([secretAccess]);
    expect(accessRows).toEqual([[secretAccess.email, '2023-11-14T22:13:20.001Z']]);
    const accessCsv = serializeCsv(['Email', 'Created at'], accessRows);
    expect(accessCsv).not.toContain('secret');
    expect(accessCsv).not.toContain(secretAccess.clientId);
    const secretDocument = { ...documents[0]!, link: ['https://example.test/secret-document'] };
    const documentCsv = serializeCsv(
      ['Type', 'Reference', 'Title', 'Status', 'Total', 'Date'],
      clientDocumentExport([secretDocument], 'en'),
    );
    expect(documentCsv).not.toContain('secret-document');
    expect(documentCsv).not.toContain(secretDocument.id);
  });

  it('uses the shared CSV escaping for formula-like visible text', () => {
    const rows = clientDocumentExport(
      [{ ...documents[0]!, title: '=HYPERLINK("https://example.test")' }],
      'en',
    );
    const csv = serializeCsv(['Type', 'Reference', 'Title', 'Status', 'Total', 'Date'], rows);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
  });
});
