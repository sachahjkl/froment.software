import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Ulid } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { Option, Schema } from 'effect';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { I18nService } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EmptyState } from '@shared/empty-state/empty-state';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { portalDocuments, type PortalDocument, PortalDocumentKind } from './portal-documents';
import {
  portalFilters,
  portalFilterQuery,
  PortalFilterKind,
  PortalFilterStatus,
  type PortalSortColumn,
} from './portal-filters';

@Component({
  host: { class: 'page-container' },
  selector: 'app-client-portal',
  imports: [
    Badge,
    Button,
    DataTable,
    EmptyState,
    FilterChip,
    FormField,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    Notice,
    PageHeader,
    RouterLink,
    SearchHighlight,
    TableSort,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './client-portal.html',
  styleUrl: './client-portal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPortal {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientPortalApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  private readonly items = signal<readonly PortalDocument[]>([]);
  private readonly model = signal(portalFilters(this.route.snapshot.queryParamMap));
  protected readonly filters = form(this.model);
  protected readonly kinds = ['quote', 'order', 'invoice'] as const;
  protected readonly kindFilterLabel = computed(() => {
    const kind = this.model().kind;
    return kind === 'all' ? this.i18n.t('portalWorkspace.all') : this.kindLabel(kind);
  });
  protected readonly kindOptions = computed(() => [
    { value: 'all', label: this.i18n.t('portalWorkspace.all') },
    ...this.kinds.map((kind) => ({ value: kind, label: this.kindLabel(kind) })),
  ]);
  protected readonly statusOptions = computed(() => [
    { value: 'all', label: this.i18n.t('portalWorkspace.allStatuses') },
    { value: 'open', label: this.i18n.t('portalWorkspace.open') },
    { value: 'completed', label: this.i18n.t('portalWorkspace.completed') },
  ]);
  protected readonly statusFilterLabel = computed(() =>
    this.i18n.t(
      this.model().status === 'all'
        ? 'portalWorkspace.allStatuses'
        : this.model().status === 'open'
          ? 'portalWorkspace.open'
          : 'portalWorkspace.completed',
    ),
  );
  protected readonly filtered = computed(
    () =>
      this.model().search.trim() !== '' ||
      this.model().kind !== 'all' ||
      this.model().status !== 'all',
  );
  protected readonly activeFilterCount = computed(
    () => Number(this.model().kind !== 'all') + Number(this.model().status !== 'all'),
  );
  protected readonly exportColumns = computed(() => [
    this.i18n.t('backOffice.client.document'),
    this.i18n.t('backOffice.quote.title'),
    this.i18n.t('portalWorkspace.kind'),
    this.i18n.t('backOffice.client.status'),
    this.i18n.t('backOffice.client.date'),
    `${this.i18n.t('backOffice.client.amount')} (EUR)`,
    `${this.i18n.t('backOffice.client.invoice.remaining')} (EUR)`,
  ]);
  private readonly target = signal('');
  private focusedTarget = '';
  private loadGeneration = 0;
  private readonly results = createFuzzySearch(
    this.items,
    computed(() => this.model().search),
    {
      keys: ['reference', 'title'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly documents = computed(() => {
    const { sort } = this.model();
    const direction = sort.endsWith('-desc') ? -1 : 1;
    const collator = new Intl.Collator(this.i18n.language(), {
      numeric: true,
      sensitivity: 'base',
    });
    return this.results()
      .filter(
        ({ item }) =>
          (this.model().kind === 'all' || item.kind === this.model().kind) &&
          (this.model().status === 'all' || item.open === (this.model().status === 'open')),
      )
      .toSorted(({ item: left }, { item: right }) => {
        const comparison = sort.startsWith('amount-')
          ? left.totalCents - right.totalCents
          : sort.startsWith('date-')
            ? Date.parse(left.date) - Date.parse(right.date)
            : sort.startsWith('kind-')
              ? collator.compare(this.kindLabel(left.kind), this.kindLabel(right.kind))
              : sort.startsWith('status-')
                ? collator.compare(this.statusLabel(left), this.statusLabel(right))
                : collator.compare(left.reference, right.reference);
        return (
          comparison * direction ||
          left.id.localeCompare(right.id) ||
          left.kind.localeCompare(right.kind)
        );
      })
      .map(({ item, matches }) => ({
        item,
        referenceMatches: matches?.find(({ key }) => key === 'reference')?.indices ?? [],
        titleMatches: matches?.find(({ key }) => key === 'title')?.indices ?? [],
      }));
  });
  protected readonly exportRows = computed<readonly (readonly (string | number | null)[])[]>(() =>
    this.state() !== 'ready'
      ? []
      : this.documents().map(({ item }) => [
          item.reference,
          item.title,
          this.kindLabel(item.kind),
          this.statusLabel(item),
          this.date(item.date),
          item.totalCents / 100,
          item.invoice ? item.invoice.remainingCents / 100 : null,
        ]),
  );

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.model.set(portalFilters(params));
        this.target.set('');
        for (const kind of this.kinds) {
          const id = Schema.decodeUnknownOption(Ulid)(params.get(kind));
          if (Option.isSome(id)) {
            this.target.set(`client-${kind}-${id.value}`);
            break;
          }
        }
      });
      void this.load();
    });
    afterRenderEffect(() => {
      if (this.state() !== 'ready' || !this.target() || this.focusedTarget === this.target())
        return;
      const target = this.document.getElementById(this.target());
      if (!target) return;
      target.scrollIntoView?.({ block: 'center' });
      target.focus({ preventScroll: true });
      this.focusedTarget = this.target();
    });
  }

  protected rowId(item: PortalDocument): string {
    return `client-${item.kind}-${item.id}`;
  }
  protected isTarget(item: PortalDocument): boolean {
    return this.rowId(item) === this.target();
  }
  protected kindLabel(kind: PortalDocumentKind): string {
    return this.i18n.t(`backOffice.search.kind.${kind}`);
  }
  protected statusLabel(item: PortalDocument): string {
    if (item.quote) return this.i18n.t(`backOffice.quote.status.${item.quote.status}`);
    if (item.invoice) return this.i18n.t(`backOffice.invoice.status.${item.invoice.status}`);
    return this.i18n.t('backOffice.client.confirmed');
  }
  protected money(cents: number, currency: string): string {
    return formatMoney(cents, this.i18n.language(), currency);
  }
  protected date(value: string): string {
    return formatLocalizedDate(value, this.i18n.language(), { dateStyle: 'medium' });
  }

  protected setFilter(field: 'search' | 'kind' | 'status', value: string): void {
    this.model.update((model) =>
      field === 'kind'
        ? {
            ...model,
            kind: Option.getOrElse(
              Schema.decodeUnknownOption(PortalFilterKind)(value),
              () => 'all' as const,
            ),
          }
        : field === 'status'
          ? {
              ...model,
              status: Option.getOrElse(
                Schema.decodeUnknownOption(PortalFilterStatus)(value),
                () => 'all' as const,
              ),
            }
          : { ...model, search: value.slice(0, 120) },
    );
    this.writeQuery();
  }
  protected resetFilters(): void {
    this.model.update((model) => ({ ...model, search: '', kind: 'all', status: 'all' }));
    this.writeQuery();
    this.filters.search().focusBoundControl();
  }
  protected sortDirection(column: PortalSortColumn): SortDirection {
    const { sort } = this.model();
    return sort === `${column}-asc`
      ? 'ascending'
      : sort === `${column}-desc`
        ? 'descending'
        : 'none';
  }
  protected sortBy(column: PortalSortColumn): void {
    const sort =
      this.sortDirection(column) === 'ascending'
        ? (`${column}-desc` as const)
        : (`${column}-asc` as const);
    this.model.update((model) => ({ ...model, sort }));
    this.writeQuery();
  }
  private writeQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.returnQuery(),
      replaceUrl: true,
    });
  }
  protected returnQuery() {
    return portalFilterQuery(this.model());
  }

  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    try {
      const [quotes, orders, invoices] = await Promise.all([
        this.api.listQuotes(),
        this.api.listOrders(),
        this.api.listInvoices(),
      ]);
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      this.items.set(portalDocuments(quotes, orders, invoices));
      this.state.set('ready');
    } catch {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration) this.state.set('error');
    }
  }
}
