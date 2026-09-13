import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { I18nService } from '@app/i18n.service';
import { FilterChoice, type FilterChoiceOption } from '@shared/filter-choice/filter-choice';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { ListSearch } from '@shared/list-search/list-search';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { TableExport } from '@shared/table-export/table-export';
import type { CsvCell } from '@shared/table-export/csv';

@Component({
  selector: 'app-workspace-table-tools',
  imports: [FilterChoice, FilterMenu, FilterPanel, ListSearch, ListToolbar, TableExport],
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-toolbar>
      <app-list-search
        listSearch
        [label]="i18n.t('listWorkspace.search')"
        [value]="query()"
        [disabled]="pending()"
        (valueChange)="queryChange.emit($event)"
      />
      <app-filter-menu
        #menu
        listFilters
        [label]="i18n.t('listWorkspace.filters')"
        [closeLabel]="i18n.t('listWorkspace.closeFilters')"
        [backLabel]="i18n.t('listWorkspace.backFilters')"
        [activeCount]="filter() === 'all' ? 0 : 1"
        [disabled]="pending()"
      >
        <ng-template appFilterPanel [label]="filterLabel()" [summary]="filterSummary()">
          <app-filter-choice
            [label]="i18n.t('listWorkspace.searchChoices')"
            [emptyLabel]="i18n.t('listWorkspace.noChoices')"
            [options]="filterOptions()"
            [value]="filter()"
            [disabled]="pending()"
            (committed)="filterChange.emit($event); menu.close()"
          />
        </ng-template>
      </app-filter-menu>
      <app-table-export
        listActions
        [columns]="columns()"
        [rows]="rows()"
        [filename]="filename()"
        [label]="i18n.t('listWorkspace.exportCsv')"
        [emptyHint]="i18n.t('listWorkspace.exportEmpty')"
        [pendingHint]="i18n.t('listWorkspace.exportPending')"
        [pending]="pending()"
      />
    </app-list-toolbar>
  `,
})
export class WorkspaceTableTools {
  protected readonly i18n = inject(I18nService);
  readonly query = input.required<string>();
  readonly filter = input.required<string>();
  readonly filterLabel = input.required<string>();
  readonly filterSummary = input.required<string>();
  readonly filterOptions = input.required<readonly FilterChoiceOption[]>();
  readonly columns = input.required<readonly string[]>();
  readonly rows = input.required<readonly (readonly CsvCell[])[]>();
  readonly filename = input.required<string>();
  readonly pending = input(false);
  readonly queryChange = output<string>();
  readonly filterChange = output<string>();
}
