import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import type { PermissionCodeValue } from '@froment/contracts';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  type EmailDraft,
  type EmailTemplate,
  type IntegrationOperationValue,
  type Reminder,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { EmailDraftsApi } from '@backoffice/email-drafts-api';
import { EmailTemplatesApi } from '@backoffice/email-templates-api';
import { RemindersApi } from '@backoffice/reminders-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { reminderErrorMessage } from '../reminder-editor/reminder-error-message';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon, type EntityIconVariant } from '@shared/entity-icon/entity-icon';
import { EmptyState } from '@shared/empty-state/empty-state';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { LocalizedDatePipe, formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { nextTableSort } from '@shared/table-sort/sort-state';
import {
  emailFilterQuery,
  emailQuery,
  emailDateMatches,
  emailDate,
  emailState,
  emailStateLabels,
  compareEmailRows,
  emailView,
  emailViews,
  type EmailView,
  type EmailSortColumn,
  messageStatus,
  reminderReasons,
  reminderStatuses,
} from './email-workspace';

@Component({
  host: { class: 'page-container' },
  imports: [
    Can,
    EntityIcon,
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
    DateRangeFilter,
    TableExport,
    LocalizedDatePipe,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    SearchHighlight,
    Tabs,
    TabLayout,
    TabPanel,
    TableSort,
  ],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-emails',
  styleUrl: './emails.scss',
  templateUrl: './emails.html',
})
export class Emails {
  private readonly authentication = inject(Authentication);
  protected viewPermissions(view: EmailView): readonly PermissionCodeValue[] {
    switch (view) {
      case 'messages':
        return ['integration.manage'];
      case 'drafts':
        return ['email.draft.manage'];
      case 'templates':
        return ['email.template.manage'];
      case 'reminders':
        return ['email.reminder.manage', 'invoice.read', 'client.read', 'integration.manage'];
    }
  }
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationsApi);
  private readonly draftsApi = inject(EmailDraftsApi);
  private readonly templatesApi = inject(EmailTemplatesApi);
  private readonly remindersApi = inject(RemindersApi);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly states = signal<Record<EmailView, 'loading' | 'ready' | 'error'>>({
    messages: 'loading',
    drafts: 'loading',
    reminders: 'loading',
    templates: 'loading',
  });
  protected readonly operations = signal<readonly IntegrationOperationValue[]>([]);
  protected readonly drafts = signal<readonly (typeof EmailDraft.Type)[]>([]);
  protected readonly templates = signal<readonly (typeof EmailTemplate.Type)[]>([]);
  protected readonly reminders = signal<readonly (typeof Reminder.Type)[]>([]);
  protected readonly busy = signal(false);
  protected readonly confirming = signal(false);
  protected readonly actionError = signal<TranslationKey | undefined>(undefined);
  protected readonly actionErrorMessage = computed(() =>
    reminderErrorMessage(this.actionError(), 'cancel'),
  );
  protected readonly query = signal(emailQuery(this.route.snapshot.queryParamMap));
  protected readonly filterCount = computed(
    () =>
      Number(this.query().state !== 'all') +
      Number(this.query().from !== undefined) +
      Number(this.query().to !== undefined),
  );
  protected readonly periodSummary = computed(() => {
    const { from, to } = this.query();
    const format = (value: string) => formatLocalizedDate(value, this.i18n.language());
    if (from && to) return `${format(from)} – ${format(to)}`;
    if (from) return this.i18n.tf('emailsWorkspace.fromFilter', { date: format(from) });
    if (to) return this.i18n.tf('emailsWorkspace.toFilter', { date: format(to) });
    return this.i18n.t('emailsWorkspace.anyPeriod');
  });
  protected readonly invalidRange = computed(() => {
    const { from, to } = this.query();
    return from !== undefined && to !== undefined && from > to;
  });
  private readonly searchModel = signal({ search: this.query().q });
  protected readonly filters = form(this.searchModel);
  protected readonly stateLabels = emailStateLabels;
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    emailViews
      .filter((view) =>
        this.viewPermissions(view).every((permission) => this.authentication.can(permission)),
      )
      .map((view) => ({
        path: view,
        id: `email-${view}-tab`,
        label: this.i18n.t(`emailsWorkspace.${view}`),
      })),
  );
  private readonly messageSearch = createFuzzySearch(
    this.operations,
    computed(() => this.filters.search().value()),
    {
      keys: ['request.subject', 'request.recipient', 'request.reference'],
      ignoreLocation: true,
      ignoreDiacritics: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly messages = computed(() =>
    this.messageSearch()
      .filter(({ item }) => emailDateMatches(item.createdAt, this.query()))
      .filter(
        ({ item }) =>
          this.query().state === 'all' ||
          this.query().state === (item.receipt?.status ?? 'pending'),
      )
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'request.subject')?.indices ?? [],
      }))
      .toSorted((left, right) =>
        compareEmailRows(
          this.messageSortRow(left.item),
          this.messageSortRow(right.item),
          this.query().sort,
          this.i18n.language(),
        ),
      ),
  );
  private readonly draftSearch = createFuzzySearch(
    this.drafts,
    computed(() => this.filters.search().value()),
    {
      keys: ['subject', 'recipient', 'reference'],
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
      includeMatches: true,
    },
  );
  protected readonly draftResults = computed(() =>
    this.draftSearch()
      .filter(({ item }) => emailDateMatches(item.updatedAt, this.query()))
      .filter(
        ({ item }) =>
          this.query().state === 'all' ||
          (item.reminder ? 'reminder' : 'draft') === this.query().state,
      )
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'subject')?.indices ?? [],
      }))
      .toSorted((left, right) =>
        compareEmailRows(
          {
            ...left.item,
            date: left.item.updatedAt,
            state: this.i18n.t(
              left.item.reminder ? 'emailsWorkspace.reminderDraft' : 'emailsWorkspace.draft',
            ),
          },
          {
            ...right.item,
            date: right.item.updatedAt,
            state: this.i18n.t(
              right.item.reminder ? 'emailsWorkspace.reminderDraft' : 'emailsWorkspace.draft',
            ),
          },
          this.query().sort,
          this.i18n.language(),
        ),
      ),
  );
  private readonly templateSearch = createFuzzySearch(
    this.templates,
    computed(() => this.filters.search().value()),
    {
      keys: ['subject'],
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
      includeMatches: true,
    },
  );
  protected readonly templateResults = computed(() =>
    this.templateSearch()
      .filter(({ item }) => emailDateMatches(item.updatedAt, this.query()))
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'subject')?.indices ?? [],
      }))
      .toSorted((left, right) =>
        compareEmailRows(
          { ...left.item, date: left.item.updatedAt },
          { ...right.item, date: right.item.updatedAt },
          this.query().sort,
          this.i18n.language(),
        ),
      ),
  );
  private readonly reminderSearch = createFuzzySearch(
    this.reminders,
    computed(() => this.filters.search().value()),
    {
      keys: ['invoiceReference'],
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.35,
      includeMatches: true,
    },
  );
  protected readonly reminderResults = computed(() =>
    this.reminderSearch()
      .filter(({ item }) => emailDateMatches(item.sendAt, this.query()))
      .filter(({ item }) => this.query().state === 'all' || item.status === this.query().state)
      .map((result) => ({
        item: result.item,
        indices: result.matches?.find((match) => match.key === 'invoiceReference')?.indices ?? [],
      }))
      .toSorted((left, right) =>
        compareEmailRows(
          {
            id: left.item.id,
            subject: left.item.invoiceReference,
            date: left.item.sendAt,
            state: this.i18n.t(reminderStatuses[left.item.status]),
          },
          {
            id: right.item.id,
            subject: right.item.invoiceReference,
            date: right.item.sendAt,
            state: this.i18n.t(reminderStatuses[right.item.status]),
          },
          this.query().sort,
          this.i18n.language(),
        ),
      ),
  );
  protected readonly status = messageStatus;
  protected readonly reminderStatuses = reminderStatuses;
  protected readonly reminderReasons = reminderReasons;
  private readonly generations = {
    messages: 0,
    drafts: 0,
    reminders: 0,
    templates: 0,
  } satisfies Record<EmailView, number>;

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const query = emailQuery(params);
        if (!this.stateOptions(this.currentView()).includes(query.state)) query.state = 'all';
        if (
          (this.currentView() === 'templates' &&
            (query.sort.startsWith('state-') || query.sort.startsWith('recipient-'))) ||
          (this.currentView() === 'reminders' && query.sort.startsWith('recipient-'))
        )
          query.sort = 'none';
        this.query.set(query);
        this.searchModel.set({ search: query.q });
      });
      for (const view of emailViews) void this.load(view);
    });
  }
  protected currentView() {
    return emailView(this.route.firstChild?.snapshot.url[0]?.path);
  }
  protected viewState(view: EmailView) {
    return this.states()[view];
  }
  protected iconVariant(operation: IntegrationOperationValue): EntityIconVariant {
    if (operation.receipt === null) return 'warning';
    if (operation.receipt.mode === 'simulation') return 'info';
    return 'success';
  }
  protected reminderIconVariant(reminder: typeof Reminder.Type): EntityIconVariant {
    if (reminder.status === 'cancelled') return 'default';
    if (reminder.status === 'skipped') return 'warning';
    return 'info';
  }
  protected createLink() {
    const view = this.currentView();
    return view === 'templates'
      ? '/backoffice/emails/templates/new'
      : view === 'reminders'
        ? '/backoffice/emails/reminders/new'
        : '/backoffice/emails/new';
  }
  protected createLabel(): TranslationKey {
    const view = this.currentView();
    return view === 'templates'
      ? 'emailsWorkspace.newTemplate'
      : view === 'reminders'
        ? 'emailsWorkspace.newReminder'
        : 'emailsWorkspace.newMessage';
  }
  protected returnQuery(view: EmailView) {
    return { ...emailFilterQuery(this.query()), view };
  }
  protected count(view: EmailView): number {
    switch (view) {
      case 'messages':
        return this.messages().length;
      case 'drafts':
        return this.draftResults().length;
      case 'templates':
        return this.templateResults().length;
      case 'reminders':
        return this.reminderResults().length;
    }
  }
  protected setSearch(value: string): void {
    const q = value.slice(0, 120);
    this.searchModel.set({ search: q });
    this.query.update((query) => ({ ...query, q }));
    this.updateQuery();
  }
  protected stateOptions(view: EmailView): readonly (keyof typeof emailStateLabels)[] {
    switch (view) {
      case 'messages':
        return ['all', 'pending', 'simulated', 'submitted'];
      case 'drafts':
        return ['all', 'draft', 'reminder'];
      case 'reminders':
        return ['all', 'scheduled', 'cancelled', 'skipped', 'queued'];
      case 'templates':
        return ['all'];
    }
  }
  protected setState(value: string): void {
    this.query.update((query) => ({ ...query, state: emailState(value) }));
    this.updateQuery();
  }
  protected clearState(): void {
    this.setState('all');
    this.filters.search().focusBoundControl();
  }
  protected setDate(field: 'from' | 'to', value: string): void {
    this.query.update((current) => ({ ...current, [field]: emailDate(value) }));
    this.updateQuery();
  }
  protected applyPeriod(range: DateRange): void {
    this.query.update((query) => ({
      ...query,
      from: emailDate(range.from),
      to: emailDate(range.to),
    }));
    this.updateQuery();
  }
  protected filterChoices(view: EmailView) {
    return this.stateOptions(view).map((value) => ({
      value,
      label: this.i18n.t(emailStateLabels[value]),
    }));
  }
  protected clearDate(field: 'from' | 'to'): void {
    this.setDate(field, '');
    this.filters.search().focusBoundControl();
  }
  protected exportColumns(view: EmailView): string[] {
    const date = this.i18n.t(
      view === 'reminders' ? 'emailsWorkspace.scheduledDate' : 'emailsWorkspace.date',
    );
    if (view === 'templates') return [this.i18n.t('emails.subject'), date];
    if (view === 'reminders')
      return [this.i18n.t('emailsWorkspace.invoice'), this.i18n.t('emailsWorkspace.status'), date];
    return [
      this.i18n.t('emails.subject'),
      this.i18n.t('emails.reference'),
      this.i18n.t('emails.recipient'),
      this.i18n.t('emailsWorkspace.status'),
      date,
    ];
  }
  protected exportRows(view: EmailView): readonly (readonly string[])[] {
    switch (view) {
      case 'messages':
        return this.messages().flatMap(({ item }) =>
          item.request.kind === 'email'
            ? [
                [
                  item.request.subject,
                  item.request.reference,
                  item.request.recipient,
                  this.i18n.t(messageStatus(item)),
                  item.createdAt,
                ],
              ]
            : [],
        );
      case 'drafts':
        return this.draftResults().map(({ item }) => [
          item.subject,
          item.reference,
          item.recipient,
          this.i18n.t(item.reminder ? 'emailsWorkspace.reminderDraft' : 'emailsWorkspace.draft'),
          item.updatedAt,
        ]);
      case 'templates':
        return this.templateResults().map(({ item }) => [item.subject, item.updatedAt]);
      case 'reminders':
        return this.reminderResults().map(({ item }) => [
          item.invoiceReference,
          this.i18n.t(reminderStatuses[item.status]),
          item.sendAt,
        ]);
    }
  }
  private messageSortRow(item: IntegrationOperationValue) {
    return {
      id: item.id,
      date: item.createdAt,
      subject: item.request.kind === 'email' ? item.request.subject : '',
      recipient: item.request.kind === 'email' ? item.request.recipient : '',
      state: this.i18n.t(messageStatus(item)),
    };
  }
  protected sortDirection(column: EmailSortColumn): SortDirection {
    return this.query().sort.startsWith(`${column}-`)
      ? this.query().sort.endsWith('-asc')
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  protected sortBy(column: EmailSortColumn): void {
    const sort = nextTableSort(this.query().sort, `${column}-asc`, `${column}-desc`);
    this.query.update((query) => ({ ...query, sort }));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: sort === 'none' ? null : sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  private updateQuery(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: emailFilterQuery(this.query()),
      replaceUrl: true,
    });
  }
  protected clearSearch(): void {
    this.setSearch('');
    this.filters.search().focusBoundControl();
  }
  protected async load(view: EmailView): Promise<void> {
    if (!this.viewPermissions(view).every((permission) => this.authentication.can(permission)))
      return;
    const generation = ++this.generations[view];
    this.states.update((value) => ({ ...value, [view]: 'loading' }));
    try {
      if (view === 'messages') {
        const result = await this.api.list('email');
        if (this.destroyRef.destroyed || generation !== this.generations[view]) return;
        this.operations.set(result.filter((operation) => operation.request.kind === 'email'));
      } else if (view === 'drafts') {
        const result = await this.draftsApi.list();
        if (this.destroyRef.destroyed || generation !== this.generations[view]) return;
        if (!result.success) throw new Error('email.drafts.unavailable');
        this.drafts.set(result.result);
      } else if (view === 'templates') {
        const result = await this.templatesApi.list();
        if (this.destroyRef.destroyed || generation !== this.generations[view]) return;
        if (!result.success) throw new Error('email.templates.unavailable');
        this.templates.set(result.result);
      } else {
        const result = await this.remindersApi.list();
        if (this.destroyRef.destroyed || generation !== this.generations[view]) return;
        if (!result.success) throw new Error('email.reminders.unavailable');
        this.reminders.set(result.result);
      }
      this.states.update((value) => ({ ...value, [view]: 'ready' }));
    } catch {
      if (!this.destroyRef.destroyed && generation === this.generations[view])
        this.states.update((value) => ({ ...value, [view]: 'error' }));
    }
  }
  protected async cancelReminder(item: typeof Reminder.Type): Promise<void> {
    if (this.busy() || this.confirming() || item.status !== 'scheduled') return;
    this.confirming.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t('reminder.cancelConfirm')))) return;
    } finally {
      this.confirming.set(false);
    }
    if (this.destroyRef.destroyed) return;
    this.busy.set(true);
    this.actionError.set(undefined);
    try {
      const outcome = await this.remindersApi.cancel(item.id);
      if (this.destroyRef.destroyed) return;
      if (outcome.success)
        this.reminders.update((items) =>
          items.map((current) => (current.id === item.id ? outcome.result : current)),
        );
      else this.actionError.set(outcome.code);
    } catch {
      this.actionError.set('reminder.error');
    } finally {
      this.busy.set(false);
    }
  }
  canDeactivate(): boolean {
    return !this.busy() && !this.confirming();
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.confirming()) event.preventDefault();
  }
}
