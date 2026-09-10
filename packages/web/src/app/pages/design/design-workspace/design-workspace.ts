import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import {
  applyEach,
  email,
  form,
  FormField,
  maxLength,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { I18nService } from '@app/i18n.service';
import { formatFixedDecimal } from '@backoffice/quote-input';
import { ActionMenu, type MenuAction } from '@shared/action-menu/action-menu';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { BulkSelection } from '@shared/bulk-selection/bulk-selection';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { EmptyState } from '@shared/empty-state/empty-state';
import { EventHistory, type HistoryEvent } from '@shared/event-history/event-history';
import { FieldGroup } from '@shared/field-group/field-group';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice, type FilterChoiceOption } from '@shared/filter-choice/filter-choice';
import { Hint } from '@shared/hint/hint';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { ResultNavigation } from '@shared/result-navigation/result-navigation';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { SplitAction } from '@shared/split-action/split-action';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { TableExport } from '@shared/table-export/table-export';
import { designWorkspaceText } from '@froment/l10n';
import {
  type DesignLine,
  lineAmount,
  lineSummary,
  validPrice,
  validQuantity,
} from './design-lines';

type Scenario = 'ready' | 'loading' | 'error' | 'empty' | 'noMatch';
type Mode = 'list' | 'detail' | 'editor';
type EventKind = 'created' | 'edited' | 'statusChanged';
interface DesignRecord {
  readonly id: string;
  readonly name: string;
  readonly contact: string;
  readonly status: 'draft' | 'ready';
  readonly lines: readonly DesignLine[];
  readonly events: readonly { readonly kind: EventKind; readonly datetime: string }[];
}

const exampleLines: DesignLine[] = [
  { id: 1, name: 'Angular', quantity: '1,500', unitPrice: '90,00' },
  { id: 2, name: 'TypeScript', quantity: '2', unitPrice: '65,50' },
];

const initialRecords: DesignRecord[] = [
  'Atlas',
  'Boréal',
  'Cobalt',
  'Delta',
  'Équinoxe',
  'Orion',
].map((name, index) => ({
  id: `DEMO-${index + 1}`,
  name,
  contact: `contact${index + 1}@example.com`,
  status: index % 2 === 0 ? 'draft' : 'ready',
  lines: exampleLines,
  events: [{ kind: 'created', datetime: '2026-09-10T09:00:00Z' }],
}));

const blankDraft = () => ({
  name: '',
  contact: '',
  lines: [{ id: 1, name: '', quantity: '1', unitPrice: '0,00' }],
});

@Component({
  imports: [
    ActionMenu,
    EntityIcon,
    Badge,
    Breadcrumbs,
    BulkSelection,
    Button,
    DataTable,
    EmptyState,
    EventHistory,
    FieldGroup,
    FilterChip,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    FormField,
    Hint,
    ListSearch,
    ListToolbar,
    ListWorkspace,
    ResultNavigation,
    SearchHighlight,
    SplitAction,
    TableSort,
    TableExport,
  ],
  providers: [SearchHighlightRegistry],
  selector: 'app-design-workspace',
  styleUrl: './design-workspace.scss',
  templateUrl: './design-workspace.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class DesignWorkspace {
  protected statusVariant(status: DesignRecord['status']): BadgeVariant {
    return status === 'ready' ? 'success' : 'default';
  }

  private readonly i18n = inject(I18nService);
  private readonly confirmation = inject(Confirmation);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('viewHeading');
  private readonly listSearch = viewChild(ListSearch);
  private readonly filterMenuElement = viewChild(FilterMenu, { read: ElementRef<HTMLElement> });
  protected readonly text = computed(() => designWorkspaceText[this.i18n.language()]);
  protected readonly filterLabels = computed(() => ({
    back: this.i18n.t('listWorkspace.backFilters'),
    search: this.i18n.t('listWorkspace.searchChoices'),
    empty: this.i18n.t('listWorkspace.noChoices'),
  }));
  protected readonly scenarioModel = signal<Scenario>('ready');
  protected readonly scenario = form(this.scenarioModel);
  protected readonly scenarios: readonly Scenario[] = [
    'ready',
    'loading',
    'error',
    'empty',
    'noMatch',
  ];
  protected readonly mode = signal<Mode>('list');
  private readonly records = signal<readonly DesignRecord[]>(initialRecords);
  private readonly recordId = signal('');
  protected readonly current = computed(() =>
    this.records().find((record) => record.id === this.recordId()),
  );
  protected readonly filterModel = signal({ query: '', status: 'all' });
  protected readonly filters = form(this.filterModel);
  protected readonly statusOptions = computed<readonly FilterChoiceOption[]>(() => [
    { value: 'all', label: this.text().allStates, count: this.records().length },
    {
      value: 'draft',
      label: this.text().draft,
      count: this.records().filter((record) => record.status === 'draft').length,
    },
    {
      value: 'ready',
      label: this.text().ready,
      count: this.records().filter((record) => record.status === 'ready').length,
    },
  ]);
  protected readonly statusLabel = computed(
    () =>
      this.statusOptions().find((option) => option.value === this.filterModel().status)?.label ??
      this.text().allStates,
  );
  protected readonly direction = signal<SortDirection>('ascending');
  private readonly query = computed(() => this.filterModel().query);
  private readonly searchResults = createFuzzySearch(this.records, this.query, {
    keys: ['name', 'id', 'contact'],
    includeMatches: true,
    ignoreDiacritics: true,
    ignoreLocation: true,
    threshold: 0.35,
  });
  protected readonly matches = computed(() => {
    if (this.scenarioModel() !== 'ready') return [];
    return this.searchResults()
      .filter(
        ({ item }) =>
          this.filterModel().status === 'all' || item.status === this.filterModel().status,
      )
      .toSorted(
        (left, right) =>
          (this.direction() === 'ascending' ? 1 : -1) *
          left.item.name.localeCompare(right.item.name, this.i18n.language()),
      )
      .map((result) => ({
        ...result,
        nameMatches: result.matches?.find((match) => match.key === 'name')?.indices ?? [],
        contactMatches: result.matches?.find((match) => match.key === 'contact')?.indices ?? [],
        referenceMatches: result.matches?.find((match) => match.key === 'id')?.indices ?? [],
      }));
  });
  private readonly pageSize = 3;
  protected readonly page = linkedSignal({
    source: () =>
      [this.filterModel(), this.direction(), this.scenarioModel(), this.records()] as const,
    computation: () => 0,
  });
  protected readonly pageRows = computed(() =>
    this.matches().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize),
  );
  protected readonly selected = linkedSignal<readonly string[]>(() => {
    this.pageRows();
    return [];
  });
  protected readonly allSelected = computed(
    () => this.pageRows().length > 0 && this.selected().length === this.pageRows().length,
  );
  protected readonly someSelected = computed(
    () => this.selected().length > 0 && !this.allSelected(),
  );
  protected readonly exportColumns = computed(() => [
    this.text().reference,
    this.text().name,
    this.text().contact,
    this.text().status,
  ]);
  protected readonly exportRows = computed(() =>
    this.matches()
      .filter(({ item }) => this.selected().length === 0 || this.selected().includes(item.id))
      .map(({ item }) => [item.id, item.name, item.contact, this.text()[item.status]]),
  );
  protected readonly canMarkSelectedReady = computed(() =>
    this.pageRows().some(
      ({ item }) => this.selected().includes(item.id) && item.status === 'draft',
    ),
  );
  protected readonly range = computed(
    () =>
      `${this.text().range} ${this.matches().length ? this.page() * this.pageSize + 1 : 0}–${Math.min((this.page() + 1) * this.pageSize, this.matches().length)} ${this.text().of} ${this.matches().length}`,
  );
  protected readonly lastPage = computed(
    () => (this.page() + 1) * this.pageSize >= this.matches().length,
  );
  protected readonly creationActions = computed<readonly MenuAction[]>(() => [
    { id: 'example', label: this.text().createExample },
  ]);
  protected readonly breadcrumbs = computed(() => [{ label: this.text().design, path: '/design' }]);
  protected readonly history = computed<readonly HistoryEvent[]>(() =>
    (this.current()?.events ?? []).map((event, index) => ({
      id: String(index),
      datetime: event.datetime,
      dateLabel: new Intl.DateTimeFormat(this.i18n.language(), {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(event.datetime)),
      title: this.text()[event.kind],
      detail: this.text().eventDetail,
    })),
  );
  protected readonly draft = signal(blankDraft());
  private baseline = JSON.stringify(this.draft());
  protected readonly editor = form(this.draft, (path) => {
    required(path.name);
    maxLength(path.name, 80);
    validate(path.name, ({ value }) => (value().trim() ? undefined : { kind: 'required' }));
    required(path.contact);
    email(path.contact);
    maxLength(path.contact, 254);
    applyEach(path.lines, (line) => {
      required(line.name);
      maxLength(line.name, 80);
      validate(line.name, ({ value }) => (value().trim() ? undefined : { kind: 'required' }));
      validate(line.quantity, ({ value }) =>
        validQuantity(value()) ? undefined : { kind: 'quantity' },
      );
      validate(line.unitPrice, ({ value }) =>
        validPrice(value()) ? undefined : { kind: 'price' },
      );
    });
  });
  protected readonly total = computed(() => lineSummary(this.draft().lines));
  protected readonly submitted = signal(false);
  protected readonly notice = signal<'saved' | 'updated' | 'removed' | undefined>(undefined);
  private nextRecord = 7;
  private nextLine = 3;

  protected money(value: number | undefined): string {
    if (value === undefined) return '—';
    return `${formatFixedDecimal(value, 2, this.i18n.language() === 'fr' ? ',' : '.')} €`;
  }
  protected amount(line: DesignLine): number | undefined {
    return lineAmount(line);
  }

  protected rowActions(record: DesignRecord): readonly MenuAction[] {
    return [
      { id: 'edit', label: this.text().edit },
      { id: 'ready', label: this.text().markReady, disabled: record.status === 'ready' },
      { id: 'remove', label: this.text().remove, danger: true },
    ];
  }
  protected toggleSelection(id: string): void {
    this.selected.update((ids) =>
      ids.includes(id) ? ids.filter((selected) => selected !== id) : [...ids, id],
    );
  }
  protected togglePage(): void {
    this.selected.set(this.allSelected() ? [] : this.pageRows().map(({ item }) => item.id));
  }
  protected clearSelected(): void {
    this.selected.set([]);
    this.listSearch()?.focus();
  }
  protected resetFilters(): void {
    this.filterModel.set({ query: '', status: 'all' });
    this.scenarioModel.set('ready');
    this.listSearch()?.focus();
  }
  protected clearQuery(): void {
    this.filterModel.update((model) => ({ ...model, query: '' }));
    this.listSearch()?.focus();
  }
  protected clearStatus(): void {
    this.filterModel.update((model) => ({ ...model, status: 'all' }));
    this.filterMenuElement()?.nativeElement.querySelector('button')?.focus();
  }
  protected changePage(offset: number): void {
    const next = this.page() + offset;
    if (next >= 0 && next * this.pageSize < this.matches().length) {
      this.page.set(next);
      this.focusHeading();
    }
  }
  protected async showList(): Promise<void> {
    if (!(await this.canDeactivate())) return;
    this.mode.set('list');
    this.submitted.set(false);
    this.focusHeading();
  }
  protected open(record: DesignRecord): void {
    this.recordId.set(record.id);
    this.mode.set('detail');
    this.notice.set(undefined);
    this.focusHeading();
  }
  protected create(withExample = false): void {
    this.recordId.set('');
    this.startEditor(
      withExample
        ? { name: 'Nova', contact: 'contact@example.com', lines: [...exampleLines] }
        : blankDraft(),
    );
  }
  protected edit(record: DesignRecord): void {
    this.recordId.set(record.id);
    this.startEditor({ name: record.name, contact: record.contact, lines: [...record.lines] });
  }
  private startEditor(value: ReturnType<typeof blankDraft>): void {
    this.draft.set(value);
    this.baseline = JSON.stringify(value);
    this.editor().reset();
    this.submitted.set(false);
    this.notice.set(undefined);
    this.mode.set('editor');
    this.focusHeading();
  }
  protected addLine(): void {
    const id = this.nextLine++;
    this.draft.update((draft) => ({
      ...draft,
      lines: [...draft.lines, { id, name: '', quantity: '1', unitPrice: '0,00' }],
    }));
    afterNextRender(
      () => this.editor.lines[this.draft().lines.length - 1].name().focusBoundControl(),
      { injector: this.injector },
    );
  }
  protected removeLine(id: number): void {
    if (this.draft().lines.length <= 1) return;
    const index = this.draft().lines.findIndex((line) => line.id === id);
    this.draft.update((draft) => ({
      ...draft,
      lines: draft.lines.filter((line) => line.id !== id),
    }));
    afterNextRender(
      () =>
        this.editor.lines[Math.min(index, this.draft().lines.length - 1)]
          .name()
          .focusBoundControl(),
      { injector: this.injector },
    );
  }
  protected save(): void {
    this.submitted.set(true);
    void submit(this.editor, {
      action: async () => {
        const current = this.current();
        const value = this.draft();
        const record: DesignRecord = {
          ...value,
          name: value.name.trim(),
          contact: value.contact.trim(),
          id: current?.id ?? `DEMO-${this.nextRecord++}`,
          status: current?.status ?? 'draft',
          events: [
            ...(current?.events ?? []),
            { kind: current ? 'edited' : 'created', datetime: new Date().toISOString() },
          ],
        };
        this.records.update((records) =>
          current
            ? records.map((item) => (item.id === current.id ? record : item))
            : [...records, record],
        );
        this.baseline = JSON.stringify(value);
        this.recordId.set(record.id);
        this.scenarioModel.set('ready');
        this.mode.set('detail');
        this.notice.set('saved');
        this.focusHeading();
      },
      onInvalid: () => {
        afterNextRender(() => this.editor().errorSummary()[0]?.fieldTree().focusBoundControl(), {
          injector: this.injector,
        });
      },
    });
  }
  protected async runAction(action: string, record: DesignRecord): Promise<void> {
    if (action === 'edit') this.edit(record);
    else if (action === 'ready') this.markReady([record.id]);
    else if (action === 'remove') await this.removeRecords([record.id]);
  }
  protected markReady(ids: readonly string[]): void {
    this.records.update((records) =>
      records.map((record) =>
        ids.includes(record.id) && record.status !== 'ready'
          ? {
              ...record,
              status: 'ready',
              events: [
                ...record.events,
                { kind: 'statusChanged', datetime: new Date().toISOString() },
              ],
            }
          : record,
      ),
    );
    this.notice.set('updated');
    if (this.mode() === 'list') this.listSearch()?.focus();
  }
  protected async removeRecords(ids: readonly string[]): Promise<void> {
    if (
      !ids.length ||
      !(await this.confirmation.request(this.text().confirmRemove, {
        acceptLabel: this.text().remove,
        variant: 'danger',
      }))
    )
      return;
    this.records.update((records) => records.filter((record) => !ids.includes(record.id)));
    this.mode.set('list');
    this.notice.set('removed');
    this.focusHeading();
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.hasChanges() ||
      this.confirmation.request(this.text().discard, {
        acceptLabel: this.text().discardLabel,
        variant: 'danger',
      })
    );
  }
  private hasChanges(): boolean {
    return this.mode() === 'editor' && JSON.stringify(this.draft()) !== this.baseline;
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  private focusHeading(): void {
    afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
  }
}
