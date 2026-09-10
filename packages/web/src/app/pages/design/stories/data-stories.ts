import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField, min, max } from '@angular/forms/signals';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { nextTableSort } from '@shared/table-sort/sort-state';
import { TableExport } from '@shared/table-export/table-export';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { BulkSelection } from '@shared/bulk-selection/bulk-selection';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { EventHistory, type HistoryEvent } from '@shared/event-history/event-history';
import { formatLocalizedDate, LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { DetailRow } from '@shared/detail-row/detail-row';
import { StoryPage, currentReference, type StoryDefinition } from '../story-page';
import { formatReferenceCount, referenceText } from '../reference-text';

interface DataPreview {
  label: string;
  query: string;
  count: number;
  layout: 'scroll' | 'fluid';
  direction: SortDirection;
  empty: boolean;
  pending: boolean;
  date: string;
  filename: string;
  firstName: string;
  firstValue: string;
}

@Component({
  selector: 'app-data-stories',
  imports: [
    NgTemplateOutlet,
    StoryPage,
    FormField,
    Button,
    DataTable,
    TableSort,
    TableExport,
    FilterChip,
    BulkSelection,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    SearchHighlight,
    EventHistory,
    LocalizedDatePipe,
    DetailRow,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './data-stories.html',
  styleUrl: './story.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition {
    return this.text().stories[this.entry.id];
  }
  protected readonly i18n = inject(I18nService);
  protected readonly model = signal<DataPreview>({
    label: this.text().content,
    query: this.text().examples.firstName,
    count: 3,
    layout: 'scroll',
    direction: 'none',
    empty: false,
    pending: false,
    date: this.text().examples.date,
    filename: this.text().examples.filename,
    firstName:
      this.entry.id === 'data-table'
        ? this.text().examples.tableName
        : this.text().examples.firstName,
    firstValue: this.text().examples.firstValue,
  });
  protected readonly controls = form(this.model, (path) => {
    min(path.count, 0);
    max(path.count, 20);
  });
  protected readonly directions: readonly SortDirection[] = ['none', 'ascending', 'descending'];
  protected readonly layouts = ['scroll', 'fluid'] as const;
  protected readonly dateStyles = ['short', 'medium', 'long'] as const;
  protected readonly highlightSamples = this.text().examples.highlights;
  protected readonly event = signal('');
  private readonly results = createFuzzySearch(
    computed(() => [
      { name: this.model().firstName, value: this.model().firstValue },
      { name: this.text().examples.secondName, value: this.text().examples.secondValue },
      { name: this.text().examples.formula, value: this.text().examples.formulaValue },
    ]),
    computed(() =>
      ['search-highlight', 'list-workspace', 'list-toolbar'].includes(this.entry.id)
        ? this.model().query
        : '',
    ),
    {
      keys: ['name'],
      includeMatches: true,
      ignoreDiacritics: true,
      ignoreLocation: true,
      threshold: 0.3,
    },
  );
  protected readonly rows = computed(() => {
    if (this.model().empty) return [];
    if (this.model().direction === 'none') return this.results();
    return this.results().toSorted(
      (a, b) =>
        (this.model().direction === 'descending' ? -1 : 1) *
        a.item.name.localeCompare(b.item.name, this.i18n.language()),
    );
  });
  protected readonly csvRows = computed(() =>
    this.rows().map(({ item }) => [item.name, item.value]),
  );
  protected readonly resultCount = computed(() =>
    formatReferenceCount(this.rows().length, this.text().language, this.text().resultCount),
  );
  protected readonly history = computed<readonly HistoryEvent[]>(() =>
    this.model().empty
      ? []
      : [
          {
            id: '1',
            datetime: this.text().examples.datetime,
            dateLabel: formatLocalizedDate(this.text().examples.date, this.i18n.language()),
            title: this.model().label,
            detail: this.text().local,
          },
        ],
  );
  protected sort(): void {
    this.model.update((value) => ({
      ...value,
      direction: nextTableSort(value.direction, 'ascending', 'descending'),
    }));
  }
  protected clear(): void {
    this.model.update((value) => ({ ...value, count: 0, query: '' }));
    this.event.set('clearSelection');
  }
}
