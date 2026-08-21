import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { type InvoiceListValue, type InvoiceStatusValue } from '@froment/contracts';

import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { BackOfficeNav } from '@shared/back-office-nav/back-office-nav';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

type PageState = 'loading' | 'ready' | 'error';
type BillingTab = InvoiceStatusValue | 'all';

@Component({
  selector: 'app-billing',
  imports: [BackOfficeNav, Badge, Button, DataTable, Notice, RouterLink, Tabs],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Billing {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  protected readonly state = signal<PageState>('loading');
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly selectedTab = signal<BillingTab>('issued');
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['draft', 'issued', 'paid', 'void', 'all'] as const).map((value) => ({
      value,
      id: `billing-${value}-tab`,
      label: this.i18n.t(`backOffice.billing.${value}`),
      panelId: 'billing-panel',
    })),
  );
  protected readonly visibleInvoices = computed(() => {
    const selected = this.selectedTab();
    if (selected === 'all') return this.invoices();
    return this.invoices().filter(({ status }) => status === selected);
  });
  protected readonly outstandingCents = computed(() =>
    this.invoices()
      .filter(({ status }) => status === 'issued')
      .reduce((total, invoice) => total + invoice.totalCents, 0),
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

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.invoices.set(await this.api.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
