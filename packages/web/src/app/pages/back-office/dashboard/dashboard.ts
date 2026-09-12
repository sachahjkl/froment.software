import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type ClientSummaryValue,
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
  type PermissionCodeValue,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import { clientContactIncomplete } from '../clients/client-contact';

type PageState = 'loading' | 'ready' | 'error';

interface DashboardAction {
  readonly permission: PermissionCodeValue;
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly client: string;
  readonly link: readonly string[];
  readonly variant: BadgeVariant;
  readonly priority: number;
  readonly task: string;
  readonly query?: Readonly<Record<string, string>>;
}

interface ActivityItem {
  readonly id: string;
  readonly title: string;
  readonly client: string;
  readonly date: string;
  readonly link: readonly string[];
}

@Component({
  host: { class: 'page-container' },
  selector: 'app-dashboard',
  imports: [Can, Badge, Button, DataTable, Notice, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly authentication = inject(Authentication);
  protected readonly i18n = inject(I18nService);
  private readonly quotesApi = inject(QuotesApi);
  private readonly clientsApi = inject(ClientsApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  protected readonly state = signal<PageState>('loading');
  private readonly destroyRef = inject(DestroyRef);
  private loadGeneration = 0;
  private readonly today = signal(this.businessToday());
  protected readonly loadedAt = signal<string | undefined>(undefined);
  private readonly clients = signal<ReadonlyArray<ClientSummaryValue>>([]);
  private readonly quotes = signal<ReadonlyArray<QuoteSummaryValue>>([]);
  private readonly orders = signal<ReadonlyArray<OrderSummaryValue>>([]);
  private readonly invoices = signal<ReadonlyArray<InvoiceSummaryValue>>([]);
  protected readonly draftQuotes = computed(
    () => this.quotes().filter(({ status }) => status === 'draft').length,
  );
  protected readonly sentQuotes = computed(
    () => this.quotes().filter(({ status }) => status === 'sent').length,
  );
  protected readonly ordersToInvoice = computed(
    () => this.orders().filter(({ invoiceId }) => invoiceId === null).length,
  );
  protected readonly outstandingCents = computed(() =>
    this.invoices()
      .filter(({ status }) => status === 'issued')
      .reduce(
        (total, invoice) =>
          total +
          Math.max(0, invoice.totalCents - invoice.creditedCents - invoice.recordedPaidCents),
        0,
      ),
  );
  protected readonly overdueInvoices = computed(
    () => this.invoices().filter((invoice) => this.overdue(invoice)).length,
  );
  protected readonly actions = computed<readonly DashboardAction[]>(() => {
    const clientById = new Map(this.clients().map((client) => [client.id, client]));
    return [
      ...this.quotes()
        .filter(({ status }) => status === 'draft' || status === 'sent')
        .map((quote): DashboardAction => {
          const client = clientById.get(quote.clientId);
          const archived = client?.archived === true;
          const incomplete =
            quote.status === 'draft' && client !== undefined && clientContactIncomplete(client);
          const blocked = archived || incomplete;
          return {
            id: `quote-${quote.id}`,
            permission: blocked
              ? archived
                ? 'client.read'
                : 'client.update'
              : quote.status === 'draft'
                ? 'quote.update'
                : 'quote.read',
            label: blocked
              ? this.i18n.t(
                  archived ? 'dashboardWorkspace.blocked' : 'dashboardWorkspace.contactBlocked',
                )
              : quote.status === 'sent'
                ? this.i18n.t('dashboardWorkspace.waiting')
                : this.i18n.t('backOffice.affairs.stage.draft'),
            title: quote.title,
            client: quote.clientDisplayName,
            link: blocked
              ? ['/backoffice/clients', quote.clientId, archived ? 'profile' : 'edit']
              : quote.status === 'draft'
                ? ['/backoffice/quotes', quote.id, 'edit']
                : ['/backoffice/quotes', quote.id],
            task: this.i18n.t(
              blocked
                ? archived
                  ? 'dashboardWorkspace.reviewClient'
                  : 'dashboardWorkspace.completeClient'
                : quote.status === 'draft'
                  ? 'dashboardWorkspace.editQuote'
                  : 'dashboardWorkspace.followQuote',
            ),
            variant: blocked ? 'danger' : 'default',
            priority: blocked ? 0 : quote.status === 'sent' ? 5 : 3,
          };
        }),
      ...this.orders()
        .filter(({ invoiceId }) => invoiceId === null)
        .map((order): DashboardAction => ({
          id: `order-${order.id}`,
          permission: 'invoice.create',
          label: this.i18n.t('backOffice.affairs.stage.ordered'),
          title: order.title,
          client: order.clientDisplayName,
          link: ['/backoffice/invoices/new'] as const,
          query: { orderId: order.id },
          task: this.i18n.t('backOffice.affairs.createInvoice'),
          variant: 'default' as const,
          priority: 2,
        })),
      ...this.invoices()
        .filter(
          (invoice) =>
            invoice.status === 'draft' ||
            invoice.pdf?.status === 'failed' ||
            (invoice.status === 'issued' && this.remaining(invoice) > 0),
        )
        .map((invoice): DashboardAction => ({
          id: `invoice-${invoice.id}`,
          permission:
            invoice.pdf?.status === 'failed'
              ? 'invoice.read'
              : this.canRemind(invoice)
                ? 'email.draft.manage'
                : invoice.status === 'draft'
                  ? 'invoice.update'
                  : 'invoice.read',
          label:
            invoice.pdf?.status === 'failed'
              ? this.i18n.t('dashboardWorkspace.pdfBlocked')
              : invoice.status === 'draft'
                ? this.i18n.t('backOffice.affairs.stage.invoiceDraft')
                : this.overdue(invoice)
                  ? this.i18n.t('backOffice.dashboard.overdue')
                  : this.i18n.t('dashboardWorkspace.waiting'),
          title: invoice.title,
          client: invoice.clientDisplayName,
          link:
            invoice.pdf?.status === 'failed'
              ? ['/backoffice/invoices', invoice.id]
              : this.canRemind(invoice)
                ? ['/backoffice/emails/new']
                : invoice.status === 'draft'
                  ? ['/backoffice/invoices', invoice.id, 'edit']
                  : ['/backoffice/invoices', invoice.id],
          query: this.canRemind(invoice) ? { invoice: invoice.id } : undefined,
          task: this.i18n.t(
            invoice.pdf?.status === 'failed'
              ? 'dashboardWorkspace.followInvoice'
              : this.canRemind(invoice)
                ? 'dashboardWorkspace.remindInvoice'
                : invoice.status === 'draft'
                  ? 'dashboardWorkspace.issueInvoice'
                  : 'dashboardWorkspace.followInvoice',
          ),
          variant:
            invoice.pdf?.status === 'failed' || this.overdue(invoice)
              ? ('danger' as const)
              : ('default' as const),
          priority:
            invoice.pdf?.status === 'failed'
              ? 0
              : this.overdue(invoice)
                ? 1
                : invoice.status === 'issued'
                  ? 5
                  : 3,
        })),
    ]
      .filter((action) => this.authentication.can(action.permission))
      .sort((left, right) => left.priority - right.priority)
      .slice(0, 12);
  });
  protected readonly activity = computed<readonly ActivityItem[]>(() =>
    [
      ...this.quotes().map((quote) => ({
        id: `quote-${quote.id}`,
        title: quote.reference,
        client: quote.clientDisplayName,
        date: quote.updatedAt,
        link: ['/backoffice/quotes', quote.id] as const,
      })),
      ...this.invoices().map((invoice) => ({
        id: `invoice-${invoice.id}`,
        title: invoice.invoiceNumber ?? invoice.orderReference,
        client: invoice.clientDisplayName,
        date: invoice.updatedAt,
        link: ['/backoffice/invoices', invoice.id] as const,
      })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected date(value: string): string {
    return formatLocalizedDate(value, this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  private remaining(invoice: InvoiceSummaryValue): number {
    return Math.max(0, invoice.totalCents - invoice.creditedCents - invoice.recordedPaidCents);
  }

  private overdue(invoice: InvoiceSummaryValue): boolean {
    return (
      invoice.status === 'issued' && this.remaining(invoice) > 0 && invoice.dueDate < this.today()
    );
  }

  private canRemind(invoice: InvoiceSummaryValue): boolean {
    return invoice.pdf?.status !== 'failed' && invoice.creditedCents === 0 && this.overdue(invoice);
  }

  private businessToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    try {
      const [clients, quotes, orders, invoices] = await Promise.all([
        this.clientsApi.list(),
        this.quotesApi.list(),
        this.ordersApi.list(),
        this.invoicesApi.list(),
      ]);
      if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
      this.today.set(this.businessToday());
      this.clients.set(clients);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.loadedAt.set(new Date().toISOString());
      this.state.set('ready');
    } catch {
      if (generation === this.loadGeneration && !this.destroyRef.destroyed) this.state.set('error');
    }
  }
}
