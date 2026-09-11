import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { disabled, form, FormField, validate } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AuditAction,
  AuditResourceType,
  type GlobalAuditPage,
  type GlobalAuditQuery,
} from '@froment/contracts';
import { Schema } from 'effect';
import { AuditApi } from '@backoffice/audit-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { ResultNavigation } from '@shared/result-navigation/result-navigation';
import { auditQuery } from './audit-query';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../workspace-table';
import { auditTableOptions } from '../workspace-tables';

const emptyPage = (): GlobalAuditPage => ({ items: [], previousCursor: null, nextCursor: null });

@Component({
  host: { class: 'page-container' },
  imports: [
    Button,
    DataTable,
    FormField,
    LocalizedDatePipe,
    Notice,
    ResultNavigation,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-audit',
  styleUrl: './audit.scss',
  templateUrl: './audit.html',
})
export class Audit {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(AuditApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly filterMenu = viewChild(FilterMenu);
  protected readonly actionOptions = computed(() => [
    { value: '', label: this.i18n.t('audit.allActions') },
    ...AuditAction.literals.map((value) => ({ value, label: value })),
  ]);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly errorMessage = computed(() =>
    this.error() === 'authentication.permission_denied' ? 'audit.readDenied' : this.error(),
  );
  protected readonly page = signal(emptyPage());
  protected readonly table = createWorkspaceTable(
    computed(() => this.page().items),
    auditTableOptions,
  );
  protected readonly auditExport = computed(() =>
    this.table
      .rows()
      .map((item) => [item.id, item.action, item.resourceType, item.resourceId, item.occurredAt]),
  );
  protected readonly query = signal<GlobalAuditQuery | undefined>(undefined);
  protected readonly filters = form(signal({ resourceType: '' }), (path) => {
    disabled(path, () => this.state() === 'loading');
    validate(path.resourceType, ({ value }) =>
      value() === '' || Schema.is(AuditResourceType)(value())
        ? undefined
        : { kind: 'resourceType' },
    );
  });
  private generation = 0;
  private serverQueryKey: string | undefined;

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = auditQuery(params);
        const key = JSON.stringify(query ?? null);
        if (key === this.serverQueryKey) return;
        this.serverQueryKey = key;
        this.query.set(query);
        this.filters().reset({
          resourceType: params.get('resourceType') ?? '',
        });
        if (query === undefined) {
          this.generation++;
          this.page.set(emptyPage());
          this.state.set('error');
          this.error.set('audit.invalid_query');
          return;
        }
        void this.pendingTasks.run(() => this.load(query));
      });
    });
  }

  private async load(query: GlobalAuditQuery): Promise<void> {
    const generation = ++this.generation;
    this.page.set(emptyPage());
    this.state.set('loading');
    this.error.set(undefined);
    const outcome = await this.api.list(query);
    if (this.destroyRef.destroyed || generation !== this.generation) return;
    if (outcome.success) {
      this.page.set(outcome.result);
      this.state.set('ready');
    } else {
      this.error.set(outcome.code);
      this.state.set('error');
    }
  }

  protected reload(): void {
    const query = this.query();
    if (query !== undefined && this.state() !== 'loading') {
      void this.pendingTasks.run(() => this.load(query));
    }
  }

  protected apply(event: SubmitEvent): void {
    event.preventDefault();
    if (this.state() === 'loading') return;
    if (this.filters().invalid()) {
      this.filters().markAsTouched();
      this.filters().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    this.navigateFilters(this.query()?.action ?? '', this.filters().value().resourceType);
  }

  protected setAction(action: string): void {
    if (this.state() === 'loading' || (action !== '' && !Schema.is(AuditAction)(action))) return;
    this.navigateFilters(action, this.query()?.resourceType ?? '');
  }

  private navigateFilters(action: string, resourceType: string): void {
    this.filterMenu()?.close();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.table.params(),
        action: action || null,
        resourceType: resourceType || null,
        limit: this.query()?.limit ?? null,
      },
    });
  }

  protected reset(): void {
    this.filters().reset({ resourceType: '' });
    this.filterMenu()?.close();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.table.params(),
        limit: this.error() === 'audit.invalid_query' ? null : (this.query()?.limit ?? null),
      },
    });
  }

  protected move(direction: 'older' | 'newer'): void {
    if (this.state() !== 'ready') return;
    const query = this.query();
    const cursor = direction === 'older' ? this.page().nextCursor : this.page().previousCursor;
    if (query === undefined || cursor === null) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...query, ...this.table.params(), cursor, direction },
    });
  }
}
