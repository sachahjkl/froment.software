import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { type TeamMember } from '@froment/contracts';
import { I18nService } from '@app/i18n.service';
import {
  createWorkspaceTable,
  sortWorkspaceRows,
  workspaceTableParams,
  workspaceTableQuery,
  type WorkspaceTableOptions,
} from './workspace-table';
import {
  auditTableOptions,
  checkoutTableOptions,
  conditionTableOptions,
  emailTableOptions,
  invitationTableOptions,
  memberTableOptions,
  tokenTableOptions,
} from './workspace-tables';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly date: number | null;
}

interface TextRow {
  readonly id: string;
  readonly name: string | null;
}
const options: WorkspaceTableOptions<Row> = {
  columns: [
    { kind: 'text', key: 'name', value: (row) => row.name },
    { kind: 'number', key: 'amount', value: (row) => row.amount },
    { kind: 'number', key: 'date', value: (row) => row.date },
  ],
  defaultSort: 'dateDesc',
  id: (row) => row.id,
  searchKeys: ['name'],
};
const rows: readonly Row[] = [
  { id: 'b', name: 'Étage 10', amount: 1000, date: 100 },
  { id: 'c', name: 'Etage 2', amount: 20, date: null },
  { id: 'a', name: 'Étage 10', amount: 20, date: 2 },
];
const results = rows.map((item, refIndex) => ({ item, refIndex }));

describe('Workspace table queries and sorting', () => {
  afterEach(() => vi.restoreAllMocks());
  it('uses only the supported columns and bounded single query values', () => {
    for (const params of [
      { sort: 'secretDesc' },
      { sort: ['nameAsc', 'nameDesc'] },
      { q: 'x'.repeat(121) },
      { q: ['one', 'two'] },
      { filter: 'invented' },
      { filter: ['all', 'all'] },
    ]) {
      expect(workspaceTableQuery(convertToParamMap(params), options)).toEqual({
        q: '',
        sort: 'none',
        filter: 'all',
      });
    }
    const query = workspaceTableQuery(
      convertToParamMap({ q: 'Etage', sort: 'amountAsc' }),
      options,
    );
    expect(workspaceTableParams(query, options)).toEqual({ q: 'Etage', sort: 'amountAsc' });
  });

  it('defines truthful defaults and does not invent dates for members or conditions', () => {
    expect(memberTableOptions.defaultSort).toBe('nameAsc');
    expect(conditionTableOptions.defaultSort).toBe('nameAsc');
    for (const definition of [
      invitationTableOptions,
      tokenTableOptions,
      emailTableOptions,
      checkoutTableOptions,
      auditTableOptions,
    ]) {
      expect(definition.defaultSort).toBe('dateDesc');
    }
    expect(conditionTableOptions.columns.map(({ key }) => key)).toEqual(['name', 'conditions']);
    const params = convertToParamMap({
      memberSort: 'emailDesc',
      invitationSort: 'expiresAsc',
      sort: 'ignored',
    });
    expect(workspaceTableQuery(params, memberTableOptions).sort).toBe('emailDesc');
    expect(workspaceTableQuery(params, invitationTableOptions).sort).toBe('expiresAsc');
    expect(
      workspaceTableQuery(
        convertToParamMap({ pageSort: 'actionAsc', sort: 'dateAsc' }),
        auditTableOptions,
      ).sort,
    ).toBe('actionAsc');
  });

  it('preserves independent member and invitation query parameters', () => {
    const params = convertToParamMap({
      memberQ: 'Émile & Camille',
      memberSort: 'emailDesc',
      memberFilter: 'disabled',
      invitationQ: 'Comptabilité',
      invitationSort: 'expiresAsc',
      invitationFilter: 'accountant',
      q: 'ignored',
      sort: 'ignored',
      filter: 'ignored',
      cursor: 'unrelated',
    });
    expect({
      ...workspaceTableParams(workspaceTableQuery(params, memberTableOptions), memberTableOptions),
      ...workspaceTableParams(
        workspaceTableQuery(params, invitationTableOptions),
        invitationTableOptions,
      ),
    }).toEqual({
      memberQ: 'Émile & Camille',
      memberSort: 'emailDesc',
      memberFilter: 'disabled',
      invitationQ: 'Comptabilité',
      invitationSort: 'expiresAsc',
      invitationFilter: 'accountant',
    });
    const defaults = convertToParamMap({
      memberQ: '',
      memberSort: 'none',
      memberFilter: 'all',
      invitationQ: '',
      invitationSort: 'none',
      invitationFilter: 'all',
    });
    expect(
      workspaceTableParams(workspaceTableQuery(defaults, memberTableOptions), memberTableOptions),
    ).toEqual({});
    expect(
      workspaceTableParams(
        workspaceTableQuery(defaults, invitationTableOptions),
        invitationTableOptions,
      ),
    ).toEqual({});
  });

  it('keeps default module keys and audit page keys separate', () => {
    expect(
      workspaceTableParams({ q: 'ERP', sort: 'usedAsc', filter: 'revoked' }, tokenTableOptions),
    ).toEqual({ q: 'ERP', sort: 'usedAsc', filter: 'revoked' });
    expect(
      workspaceTableParams(
        { q: 'Terms', sort: 'conditionsDesc', filter: 'all' },
        conditionTableOptions,
      ),
    ).toEqual({ q: 'Terms', sort: 'conditionsDesc' });
    expect(
      workspaceTableParams({ q: 'Test', sort: 'dateDesc', filter: 'delivered' }, emailTableOptions),
    ).toEqual({ q: 'Test', sort: 'dateDesc', filter: 'delivered' });
    expect(
      workspaceTableParams({ q: 'INV-2', sort: 'amountAsc', filter: 'paid' }, checkoutTableOptions),
    ).toEqual({ q: 'INV-2', sort: 'amountAsc', filter: 'paid' });
    const params = convertToParamMap({
      pageQ: 'invoice',
      pageSort: 'actionAsc',
      pageFilter: 'all',
      action: 'invoice.created',
      resourceType: 'invoice',
      cursor: 'unrelated',
    });
    expect(
      workspaceTableParams(workspaceTableQuery(params, auditTableOptions), auditTableOptions),
    ).toEqual({ pageQ: 'invoice', pageSort: 'actionAsc' });
  });

  it('declares numeric columns for dates and amounts and text columns for labels', () => {
    expect(memberTableOptions.columns.every((column) => column.kind === 'text')).toBe(true);
    expect(conditionTableOptions.columns.every((column) => column.kind === 'text')).toBe(true);
    expect(
      invitationTableOptions.columns
        .filter((column) => column.kind === 'number')
        .map(({ key }) => key),
    ).toEqual(['date', 'expires']);
    expect(
      tokenTableOptions.columns.filter((column) => column.kind === 'number').map(({ key }) => key),
    ).toEqual(['date', 'expires', 'used']);
    expect(
      emailTableOptions.columns.filter((column) => column.kind === 'number').map(({ key }) => key),
    ).toEqual(['date']);
    expect(
      checkoutTableOptions.columns
        .filter((column) => column.kind === 'number')
        .map(({ key }) => key),
    ).toEqual(['date', 'amount']);
    expect(
      auditTableOptions.columns.filter((column) => column.kind === 'number').map(({ key }) => key),
    ).toEqual(['date']);
  });

  it('compares raw numbers and timestamps and keeps nulls last', () => {
    expect(
      sortWorkspaceRows(results, options, 'amountAsc', 'fr').map(({ item }) => item.id),
    ).toEqual(['a', 'c', 'b']);
    expect(
      sortWorkspaceRows(results, options, 'dateDesc', 'fr').map(({ item }) => item.id),
    ).toEqual(['b', 'a', 'c']);
    expect(sortWorkspaceRows(results, options, 'dateAsc', 'fr').map(({ item }) => item.id)).toEqual(
      ['a', 'b', 'c'],
    );
    expect(results.map(({ item }) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('uses locale-aware natural text order with stable identifiers for ties', () => {
    for (const language of ['fr', 'en'] as const) {
      expect(
        sortWorkspaceRows(results, options, 'nameAsc', language).map(({ item }) => item.id),
      ).toEqual(['c', 'a', 'b']);
      expect(
        sortWorkspaceRows(results.toReversed(), options, 'nameDesc', language).map(
          ({ item }) => item.id,
        ),
      ).toEqual(['a', 'b', 'c']);
    }
  });

  it('keeps nullable text last in both directions and uses identifiers for equal values', () => {
    const textOptions: WorkspaceTableOptions<TextRow> = {
      columns: [{ kind: 'text', key: 'name', value: (row) => row.name }],
      defaultSort: 'nameAsc',
      id: (row) => row.id,
      searchKeys: ['name'],
    };
    const items: readonly TextRow[] = [
      { id: 'd', name: null },
      { id: 'e', name: 'beta' },
      { id: 'c', name: null },
      { id: 'b', name: 'Beta' },
      { id: 'a', name: 'Alpha' },
    ];
    const results = items.map((item, refIndex) => ({ item, refIndex }));
    expect(
      sortWorkspaceRows(results, textOptions, 'nameAsc', 'fr').map(({ item }) => item.id),
    ).toEqual(['a', 'b', 'e', 'c', 'd']);
    expect(
      sortWorkspaceRows(results.toReversed(), textOptions, 'nameDesc', 'fr').map(
        ({ item }) => item.id,
      ),
    ).toEqual(['b', 'e', 'a', 'c', 'd']);
  });

  it('orders equal null timestamps by stable identifiers in both directions', () => {
    const withNull = [
      ...results,
      { item: { id: 'd', name: 'None', amount: 0, date: null }, refIndex: 3 },
    ];
    expect(
      sortWorkspaceRows(withNull, options, 'dateAsc', 'en').map(({ item }) => item.id),
    ).toEqual(['a', 'b', 'c', 'd']);
    expect(
      sortWorkspaceRows(withNull.toReversed(), options, 'dateDesc', 'en').map(
        ({ item }) => item.id,
      ),
    ).toEqual(['b', 'a', 'c', 'd']);
  });

  it('uses Fuse matches and retains independent URL context when sorting', () => {
    const queryParamMap = new BehaviorSubject(
      convertToParamMap({ q: 'Etge 10', sort: 'nameAsc', unrelated: 'retained' }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap } }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const table = TestBed.runInInjectionContext(() => createWorkspaceTable(signal(rows), options));
    expect(table.rows().map(({ id }) => id)).toContain('a');
    expect(table.results().some((result) => table.match(result, 'name').length > 0)).toBe(true);
    table.sort('name');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'Etge 10', sort: 'nameDesc', filter: null },
        queryParamsHandling: 'merge',
        replaceUrl: false,
      }),
    );
    queryParamMap.next(convertToParamMap({ q: 'Etge 10', sort: 'nameDesc' }));
    expect(table.direction('name')).toBe('descending');
    expect(table.params()).toEqual({ q: 'Etge 10', sort: 'nameDesc' });
    table.sort('name');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { q: 'Etge 10', sort: null, filter: null },
        queryParamsHandling: 'merge',
      }),
    );
    queryParamMap.next(convertToParamMap({}));
    expect(table.direction('date')).toBe('none');
    expect(table.params()).toEqual({});
    expect(table.results()).toEqual(sortWorkspaceRows(results, options, 'dateDesc', 'fr'));
  });

  it('resets the default column without clearing filters or another table state', () => {
    const queryParamMap = new BehaviorSubject(
      convertToParamMap({
        memberQ: 'Camille',
        memberFilter: 'active',
        memberSort: 'nameDesc',
        invitationSort: 'dateAsc',
        invitationQ: 'Comptabilité',
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap } }],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const table = TestBed.runInInjectionContext(() =>
      createWorkspaceTable(signal<readonly (typeof TeamMember.Type)[]>([]), memberTableOptions),
    );
    table.sort('name');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { memberQ: 'Camille', memberFilter: 'active', memberSort: null },
        queryParamsHandling: 'merge',
      }),
    );
    queryParamMap.next(convertToParamMap({ memberQ: 'Camille', memberFilter: 'active' }));
    expect(table.query().sort).toBe('none');
    table.sort('name');
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({
        queryParams: { memberQ: 'Camille', memberFilter: 'active', memberSort: 'nameAsc' },
        queryParamsHandling: 'merge',
      }),
    );
  });

  it('sorts translated profiles in the selected language', () => {
    const members: readonly (typeof TeamMember.Type)[] = [
      {
        id: 'a',
        displayName: 'A',
        email: 'a@example.test',
        profile: 'accountant',
        version: 1,
        disabledAt: null,
      },
      {
        id: 'b',
        displayName: 'B',
        email: 'b@example.test',
        profile: 'collaborator',
        version: 1,
        disabledAt: null,
      },
    ];
    const results = members.map((item, refIndex) => ({ item, refIndex }));
    expect(
      sortWorkspaceRows(results, memberTableOptions, 'profileAsc', 'fr').map(({ item }) => item.id),
    ).toEqual(['b', 'a']);
    expect(
      sortWorkspaceRows(results, memberTableOptions, 'profileAsc', 'en').map(({ item }) => item.id),
    ).toEqual(['a', 'b']);
  });

  it('provides translated filter choices and summaries from validated URL state', () => {
    const queryParamMap = new BehaviorSubject(convertToParamMap({ memberFilter: 'disabled' }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap } }],
    });
    const i18n = TestBed.inject(I18nService);
    i18n.language.set('fr');
    const table = TestBed.runInInjectionContext(() =>
      createWorkspaceTable(signal<readonly (typeof TeamMember.Type)[]>([]), memberTableOptions),
    );
    expect(table.filterOptions()).toEqual([
      { value: 'all', label: 'Toutes les lignes' },
      { value: 'active', label: 'Actif' },
      { value: 'disabled', label: 'Désactivé' },
    ]);
    expect(table.filterSummary()).toBe('Désactivé');
    i18n.language.set('en');
    expect(table.filterSummary()).toBe('Disabled');
    queryParamMap.next(convertToParamMap({ memberFilter: 'unsupported' }));
    expect(table.filterSummary()).toBe('All rows');
    expect(table.params()).toEqual({});
  });
});
