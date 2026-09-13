import { formatMoney } from '@froment/l10n';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
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
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  Affair,
  ClientUpdateRequest,
  Ulid,
  type ClientAccessValue,
  type ClientSummaryValue,
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientsApi, type ClientErrorCode } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { AffairsApi } from '@backoffice/affairs-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { ActionMenu } from '@shared/action-menu/action-menu';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { PageHeader } from '@shared/page-header/page-header';
import { EmptyState } from '@shared/empty-state/empty-state';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { InlineEdit } from '@shared/inline-edit/inline-edit';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import { TableSort, type SortDirection } from '@shared/table-sort/table-sort';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { clientFilters, clientFilterQuery, clientView } from '../clients/client-filters';
import {
  clientAffairTableOptions,
  clientDocumentTableOptions,
  clientAccessTableOptions,
  clientAffairExport,
  clientDocumentExport,
  clientAccessExport,
  type ClientDocument,
} from './client-tables';
import {
  ClientAccessPeriod,
  clientAccessPeriod,
  clientAccessPeriodParams,
  clientAccessMatchesPeriod,
} from './client-access-period';

type ClientField =
  | 'displayName'
  | 'email'
  | 'phone'
  | 'addressLine1'
  | 'addressLine2'
  | 'postalCode'
  | 'city'
  | 'country';

@Component({
  host: { class: 'page-container' },
  selector: 'app-client-detail',
  imports: [
    Can,
    ActionMenu,
    Badge,
    Button,
    DataTable,
    Notice,
    RouterLink,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    PageHeader,
    EmptyState,
    EntityIcon,
    InlineEdit,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    FilterChip,
    DateRangeFilter,
    TableSort,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetail {
  private readonly authentication = inject(Authentication);
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly affairsApi = inject(AffairsApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly backLink = computed(() => [
    '/backoffice/clients',
    clientView(this.queryParams().get('view')),
  ]);
  protected readonly returnQuery = computed(() =>
    clientFilterQuery(clientFilters(this.queryParams())),
  );
  private loadGeneration = 0;
  protected readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly editingField = signal<ClientField | undefined>(undefined);
  protected readonly savingField = signal<ClientField | undefined>(undefined);
  protected readonly addressFields = [
    { name: 'addressLine1', label: 'backOffice.clients.addressLine1', maximumLength: 160 },
    { name: 'addressLine2', label: 'backOffice.clients.addressLine2', maximumLength: 160 },
    { name: 'postalCode', label: 'backOffice.clients.postalCode', maximumLength: 32 },
    { name: 'city', label: 'backOffice.clients.city', maximumLength: 120 },
    { name: 'country', label: 'backOffice.clients.country', maximumLength: 120 },
  ] as const;
  protected readonly archiving = signal(false);
  protected readonly documentsError = signal(false);
  protected readonly affairsError = signal(false);
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['profile', 'affairs', 'documents', 'access'] as const)
      .filter((value) => value !== 'access' || this.authentication.can('client.access.manage'))
      .filter((value) => value !== 'affairs' || this.authentication.can('quote.read'))
      .map((value) => ({
        path: value,
        id: `client-${value}-tab`,
        label: this.i18n.t(
          value === 'affairs' ? 'clientsWorkspace.affairs' : `backOffice.clientDetail.tab.${value}`,
        ),
      })),
  );
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  private readonly allAffairs = signal<ReadonlyArray<typeof Affair.Type>>([]);
  protected readonly affairs = computed(() =>
    this.allAffairs()
      .filter(({ clientId }) => clientId === this.client()?.id)
      .map((affair, position) => ({ ...affair, position })),
  );
  protected readonly documentsLoading = signal(true);
  protected readonly documents = computed<readonly ClientDocument[]>(() => {
    const id = this.client()?.id;
    if (!id) return [];
    return [
      ...this.quotes()
        .filter(({ clientId }) => clientId === id)
        .map((quote) => ({
          id: `quote-${quote.id}`,
          type: 'quote' as const,
          kind: this.i18n.t('backOffice.clientDetail.quote'),
          reference: quote.reference,
          title: quote.title,
          status: this.i18n.t(`backOffice.quote.status.${quote.status}`),
          totalCents: quote.totalCents,
          link: ['/backoffice/quotes', quote.id] as const,
          updatedAt: quote.updatedAt,
        })),
      ...this.orders()
        .filter(({ clientId }) => clientId === id)
        .map((order) => ({
          id: `order-${order.id}`,
          type: 'order' as const,
          kind: this.i18n.t('backOffice.clientDetail.order'),
          reference: order.reference,
          title: order.title,
          status: this.i18n.t('backOffice.clientDetail.confirmed'),
          totalCents: order.totalCents,
          link: ['/backoffice/orders', order.id] as const,
          updatedAt: order.createdAt,
        })),
      ...this.invoices()
        .filter(({ clientId }) => clientId === id)
        .map((invoice) => ({
          id: `invoice-${invoice.id}`,
          type: 'invoice' as const,
          kind: this.i18n.t('backOffice.clientDetail.invoice'),
          reference: invoice.invoiceNumber ?? this.i18n.t('commercialHeader.draftInvoice'),
          title: invoice.title,
          status: this.i18n.t(`backOffice.invoice.status.${invoice.status}`),
          totalCents: invoice.totalCents,
          link: ['/backoffice/invoices', invoice.id] as const,
          updatedAt: invoice.updatedAt,
        })),
    ];
  });
  protected readonly accessesLoading = signal(true);
  protected readonly accessesError = signal<TranslationKey | undefined>(undefined);
  protected readonly accesses = signal<ReadonlyArray<ClientAccessValue>>([]);
  protected readonly revokingAccessId = signal<string | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly reactivating = signal(false);
  protected readonly archived = computed(() => this.client()?.archived ?? false);
  protected readonly canEditProfile = computed(
    () => this.authentication.can('client.update') && !this.archived(),
  );
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly statusVariant = computed<BadgeVariant>(() =>
    this.archived() ? 'warning' : 'success',
  );
  protected readonly statusLabel = computed<TranslationKey>(() =>
    this.archived() ? 'backOffice.clients.archived' : 'backOffice.clients.active',
  );
  protected readonly reactivateLabel = computed<TranslationKey>(() =>
    this.reactivating()
      ? 'backOffice.clientDetail.reactivating'
      : 'backOffice.clientDetail.reactivate',
  );
  protected readonly affairTable = createWorkspaceTable(this.affairs, clientAffairTableOptions);
  protected readonly documentTable = createWorkspaceTable(
    this.documents,
    clientDocumentTableOptions,
  );
  protected readonly accessPeriod = computed(() => clientAccessPeriod(this.queryParams()));
  protected readonly accessFilterCount = computed(() =>
    Number(this.accessPeriod().from !== undefined || this.accessPeriod().to !== undefined),
  );
  protected readonly accessPeriodSummary = computed(() => {
    const { from, to } = this.accessPeriod();
    const labels: string[] = [];
    if (from)
      labels.push(
        `${this.i18n.t('dateRangeFilter.from')} : ${formatLocalizedDate(from, this.i18n.language())}`,
      );
    if (to)
      labels.push(
        `${this.i18n.t('dateRangeFilter.to')} : ${formatLocalizedDate(to, this.i18n.language())}`,
      );
    return labels.join(' · ') || this.i18n.t('configurationWorkspace.allRows');
  });
  protected readonly accessTable = createWorkspaceTable(
    computed(() =>
      this.accesses()
        .map((access, position) => ({ ...access, position }))
        .filter((access) => clientAccessMatchesPeriod(access, this.accessPeriod())),
    ),
    clientAccessTableOptions,
  );
  protected readonly affairFilterCount = computed(() =>
    Number(this.affairTable.query().filter !== 'all'),
  );
  protected readonly documentFilterCount = computed(() =>
    Number(this.documentTable.query().filter !== 'all'),
  );
  protected readonly affairEmptyLabel = computed<TranslationKey>(() =>
    this.affairs().length === 0 ? 'clientsWorkspace.affairsEmpty' : 'clientTables.affairNoMatches',
  );
  protected readonly documentEmptyLabel = computed<TranslationKey>(() =>
    this.documents().length === 0
      ? 'backOffice.clientDetail.documentsEmpty'
      : 'clientTables.documentNoMatches',
  );
  protected readonly accessEmptyLabel = computed<TranslationKey>(() =>
    this.accesses().length === 0
      ? 'backOffice.clientDetail.accessListEmpty'
      : 'clientTables.accessNoMatches',
  );
  protected readonly affairExportColumns = computed(() => [
    this.i18n.t('clientTables.reference'),
    this.i18n.t('clientTables.title'),
    this.i18n.t('clientTables.affairStatus'),
    this.i18n.t('clientTables.updatedAt'),
  ]);
  protected readonly documentExportColumns = computed(() => [
    this.i18n.t('clientTables.documentType'),
    this.i18n.t('clientTables.reference'),
    this.i18n.t('clientTables.title'),
    this.i18n.t('backOffice.clientDetail.status'),
    this.i18n.t('backOffice.clientDetail.total'),
    this.i18n.t('clientTables.date'),
  ]);
  protected readonly accessExportColumns = computed(() => [
    this.i18n.t('backOffice.clientDetail.accessEmail'),
    this.i18n.t('backOffice.clientDetail.accessCreatedAt'),
  ]);
  protected readonly affairExportRows = computed(() => {
    if (this.documentsLoading() || this.affairsError()) return [];
    return clientAffairExport(this.affairTable.rows(), this.i18n.language());
  });
  protected readonly documentExportRows = computed(() => {
    if (this.documentsLoading() || this.documentsError()) return [];
    return clientDocumentExport(this.documentTable.rows(), this.i18n.language());
  });
  protected readonly accessExportPending = computed(
    () => this.accessesLoading() || this.revokingAccessId() !== undefined,
  );
  protected readonly accessExportRows = computed(() => {
    if (this.accessExportPending() || this.accessesError()) return [];
    return clientAccessExport(this.accessTable.rows());
  });

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  async canDeactivate(): Promise<boolean> {
    return (
      !this.revokingAccessId() && !this.archiving() && !this.reactivating() && !this.savingField()
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.revokingAccessId() || this.archiving() || this.reactivating() || this.savingField())
      event.preventDefault();
  }

  protected async saveField(field: ClientField, value: string): Promise<void> {
    const client = this.client();
    if (!client || this.savingField() || !this.canEditProfile()) return;
    this.savingField.set(field);
    this.error.set(undefined);
    const outcome = await this.api.update(
      client.id,
      ClientUpdateRequest.make({
        displayName: client.displayName,
        addressLine1: client.addressLine1,
        addressLine2: client.addressLine2,
        postalCode: client.postalCode,
        city: client.city,
        country: client.country,
        email: client.email,
        phone: client.phone,
        [field]: value,
        expectedUpdatedAt: client.updatedAt,
      }),
    );
    this.savingField.set(undefined);
    if (!outcome.success) return this.setError(outcome.code);
    this.client.set(outcome.result);
    this.editingField.set(undefined);
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected quoteStatus(status: QuoteSummaryValue['status']): string {
    return this.i18n.t(`backOffice.quote.status.${status}`);
  }

  protected affairStatus(status: (typeof Affair.Type)['status']): string {
    return this.i18n.t(`affair.${status}`);
  }

  protected formatDate(timestamp: number | string): string {
    return formatLocalizedDate(new Date(timestamp), this.i18n.language(), { dateStyle: 'medium' });
  }

  protected dateTime(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  protected ariaSort(direction: SortDirection): Exclude<SortDirection, 'none'> | null {
    return direction === 'none' ? null : direction;
  }

  protected revokeLabel(access: ClientAccessValue): TranslationKey {
    return this.revokingAccessId() === access.id
      ? 'backOffice.clientDetail.accessRevoking'
      : 'backOffice.clientDetail.accessRevoke';
  }

  protected applyAccessPeriod(range: DateRange): void {
    const period = Schema.decodeUnknownOption(ClientAccessPeriod)(range);
    if (Option.isNone(period)) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: clientAccessPeriodParams(period.value),
      queryParamsHandling: 'merge',
    });
  }

  protected async revokeAccess(access: ClientAccessValue): Promise<void> {
    const client = this.client();
    if (
      client === undefined ||
      this.revokingAccessId() !== undefined ||
      !(await this.confirmation.request(
        this.i18n.tf('backOffice.clientDetail.accessRevokeConfirmation', {
          email: access.email,
        }),
      ))
    ) {
      return;
    }
    this.revokingAccessId.set(access.id);
    this.error.set(undefined);
    const outcome = await this.api.revokeAccess(client.id, access.id);
    this.revokingAccessId.set(undefined);
    if (!outcome.success) {
      this.setError(outcome.code);
      return;
    }
    this.accesses.update((accesses) => accesses.filter(({ id }) => id !== access.id));
  }

  protected async reactivate(): Promise<void> {
    const client = this.client();
    if (!client?.archived || this.reactivating()) return;
    this.reactivating.set(true);
    this.error.set(undefined);
    const outcome = await this.api.reactivate(client.id);
    this.reactivating.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.client.set(outcome.result);
    void this.router.navigate(['access'], {
      relativeTo: this.route,
      queryParamsHandling: 'preserve',
    });
  }

  protected async archive(): Promise<void> {
    const current = this.client();
    if (!current || current.archived || this.archiving()) return;
    if (
      !(await this.confirmation.request(this.i18n.t('backOffice.clients.archiveConfirmation'), {
        variant: 'danger',
      }))
    )
      return;
    this.archiving.set(true);
    this.error.set(undefined);
    const outcome = await this.api.archive(current.id);
    this.archiving.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.client.set(outcome.result);
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.client.set(undefined);
    this.documentsLoading.set(true);
    this.documentsError.set(false);
    this.affairsError.set(false);
    this.accessesError.set(undefined);
    this.quotes.set([]);
    this.allAffairs.set([]);
    this.orders.set([]);
    this.invoices.set([]);
    this.accesses.set([]);
    this.accessesLoading.set(true);
    this.error.set(undefined);
    const clientId = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('clientId'));
    if (Option.isNone(clientId)) {
      this.error.set('client.not_found');
      this.loading.set(false);
      return;
    }
    const outcome = await this.api.get(clientId.value);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (!outcome.success) {
      this.setError(outcome.code);
      this.loading.set(false);
      return;
    }
    this.client.set(outcome.result);
    this.loading.set(false);
    const affairsPromise = this.authentication.can('quote.read')
      ? this.affairsApi.list()
      : Promise.resolve({ success: true as const, result: [] });
    const [affairs, quotes, orders, invoices, accesses] = await Promise.allSettled([
      affairsPromise,
      this.authentication.can('quote.read') ? this.quotesApi.list() : [],
      this.authentication.can('order.read') ? this.ordersApi.list() : [],
      this.authentication.can('invoice.read') ? this.invoicesApi.list() : [],
      this.authentication.can('client.access.manage')
        ? this.api.listAccess(clientId.value)
        : Promise.resolve({ success: true as const, result: [] }),
    ]);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (affairs.status === 'fulfilled' && affairs.value.success)
      this.allAffairs.set(affairs.value.result);
    if (quotes.status === 'fulfilled') this.quotes.set(quotes.value);
    if (orders.status === 'fulfilled') this.orders.set(orders.value);
    if (invoices.status === 'fulfilled') this.invoices.set(invoices.value);
    if (accesses.status === 'fulfilled') {
      if (accesses.value.success) this.accesses.set(accesses.value.result);
      else this.accessesError.set(accesses.value.code);
    } else {
      this.accessesError.set('client.error');
    }
    this.accessesLoading.set(false);
    this.documentsError.set([quotes, orders, invoices].some(({ status }) => status === 'rejected'));
    this.affairsError.set(
      affairs.status === 'rejected' || (affairs.status === 'fulfilled' && !affairs.value.success),
    );
    this.documentsLoading.set(false);
  }

  private setError(code: ClientErrorCode): void {
    this.error.set(code);
  }
}
