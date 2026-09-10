import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { EmailTestHistory } from './email-test-history';
import { emailTestStatusLabel } from './email-test-view';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { emailTableOptions } from '../configuration/workspace-tables';
import { providerTabs } from '../connections/provider-navigation';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

@Component({
  host: { class: 'page-container' },
  imports: [
    Button,
    Notice,
    RouterLink,
    DataTable,
    LocalizedDatePipe,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    SearchHighlight,
    PageHeader,
    Tabs,
    FilterChip,
  ],
  providers: [SearchHighlightRegistry, EmailTestHistory],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-email-test-list',
  styleUrl: './email-test-list.scss',
  templateUrl: './email-test-list.html',
})
export class EmailTestList {
  protected readonly i18n = inject(I18nService);
  protected readonly history = inject(EmailTestHistory);
  protected readonly table = createWorkspaceTable(this.history.operations, emailTableOptions);
  protected readonly tabs = computed(() => providerTabs('resend', this.i18n));
  protected readonly statusLabel = emailTestStatusLabel;
  protected readonly activeFilterCount = computed(() =>
    Number(this.table.query().filter !== 'all'),
  );
  protected readonly historyLabel = computed<TranslationKey>(() =>
    this.history.paused() ? 'emailTest.historyUnavailable' : 'connections.loading',
  );
  protected readonly exportPending = computed(
    () => !this.history.loaded() || this.history.paused(),
  );
  private readonly search = viewChild(ListSearch);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly testExport = computed(() =>
    this.table.rows().map((item) => [item.createdAt, item.request.subject, item.status]),
  );

  constructor() {
    afterNextRender(() => {
      this.history.watch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    });
  }

  protected removeFilter(): void {
    this.table.filter('all');
    this.search()?.focus();
  }
}
