import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import {
  type ClientListValue,
  type InvoiceListValue,
  type InvoiceStatusValue,
} from '@froment/contracts';

import { ClientsApi } from '@backoffice/clients-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';

type PageState = 'loading' | 'ready' | 'error';
type BillingTab = InvoiceStatusValue | 'all';

@Component({
  selector: 'app-billing',
  imports: [Badge, Button, DataTable, Notice, RouterLink, RouterOutlet, TabLayout, TabPanel, Tabs],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  private readonly clientsApi = inject(ClientsApi);
  protected readonly state = signal<PageState>('loading');
  protected readonly invoices = signal<InvoiceListValue>([]);
  private readonly clients = signal<ClientListValue>([]);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['draft', 'issued', 'paid', 'void', 'all'] as const).map((value) => ({
      path: value,
      id: `billing-${value}-tab`,
      label: this.i18n.t(`backOffice.billing.${value}`),
    })),
  );
  protected visibleInvoices(selected: BillingTab): InvoiceListValue {
    if (selected === 'all') return this.invoices();
    return this.invoices().filter(({ status }) => status === selected);
  }
  protected readonly outstandingCents = computed(() =>
    this.invoices()
      .filter(({ status }) => status === 'issued')
      .reduce((total, invoice) => total + invoice.totalCents - invoice.recordedPaidCents, 0),
  );
  protected readonly selectedInvoices = computed(() => {
    const selectedIds = this.selectedIds();
    return this.invoices().filter((invoice) => selectedIds.has(invoice.id));
  });
  protected readonly bulkReminderHref = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    const selectedClientIds = new Set(
      this.selectedInvoices()
        .filter((invoice) => invoice.status === 'issued' && invoice.dueDate < today)
        .map((invoice) => invoice.clientId),
    );
    const recipients = this.clients()
      .filter((client) => selectedClientIds.has(client.id) && client.email)
      .map((client) => client.email);
    if (recipients.length === 0) return undefined;
    const subject = this.i18n.t('backOffice.billing.bulkReminder.subject');
    const body = this.i18n.t('backOffice.billing.bulkReminder.body');
    return `mailto:?bcc=${encodeURIComponent([...new Set(recipients)].join(','))}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  protected readonly exportCount = computed(
    () => this.selectedInvoices().filter((invoice) => invoice.pdf?.status === 'ready').length,
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'medium' }).format(
      new Date(value),
    );
  }

  protected statusLabel(status: InvoiceStatusValue): string {
    return this.i18n.t(`backOffice.invoice.status.${status}`);
  }

  protected statusVariant(status: InvoiceStatusValue): BadgeVariant {
    if (status === 'paid') return 'success';
    if (status === 'void') return 'danger';
    if (status === 'issued') return 'warning';
    return 'default';
  }

  protected dueLabel(status: InvoiceStatusValue, dueDate: string): string {
    if (status !== 'issued') return this.i18n.t('backOffice.billing.due.closed');
    const today = new Date().toISOString().slice(0, 10);
    if (dueDate < today) return this.i18n.t('backOffice.billing.due.overdue');
    if (dueDate === today) return this.i18n.t('backOffice.billing.due.today');
    if (this.isDueSoon(dueDate)) {
      return this.i18n.tf('backOffice.billing.due.soon', { date: dueDate });
    }
    return this.i18n.tf('backOffice.billing.due.upcoming', { date: dueDate });
  }

  protected dueVariant(status: InvoiceStatusValue, dueDate: string): BadgeVariant {
    if (status !== 'issued') return 'default';
    if (dueDate < new Date().toISOString().slice(0, 10)) return 'danger';
    return this.isDueSoon(dueDate) ? 'warning' : 'default';
  }

  private isDueSoon(dueDate: string): boolean {
    const limit = new Date();
    limit.setUTCDate(limit.getUTCDate() + 7);
    return dueDate <= limit.toISOString().slice(0, 10);
  }

  protected toggle(invoiceId: string, checked: boolean): void {
    const selectedIds = new Set(this.selectedIds());
    if (checked) selectedIds.add(invoiceId);
    else selectedIds.delete(invoiceId);
    this.selectedIds.set(selectedIds);
  }

  protected selectVisible(tab: BillingTab, checked: boolean): void {
    const selectedIds = new Set(this.selectedIds());
    for (const invoice of this.visibleInvoices(tab)) {
      if (checked) selectedIds.add(invoice.id);
      else selectedIds.delete(invoice.id);
    }
    this.selectedIds.set(selectedIds);
  }

  protected exportSelected(): void {
    for (const invoice of this.selectedInvoices()) {
      if (invoice.pdf?.status !== 'ready') continue;
      const link = document.createElement('a');
      link.href = `/api/invoices/${invoice.id}/revisions/${invoice.version}/pdf`;
      link.download = '';
      link.click();
    }
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.invoices.set(await this.api.list());
      this.state.set('ready');
      void this.clientsApi
        .list()
        .then((clients) => this.clients.set(clients))
        .catch(() => undefined);
    } catch {
      this.state.set('error');
    }
  }
}
