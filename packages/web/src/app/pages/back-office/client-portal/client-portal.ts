import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  type ClientInvoiceListValue,
  type ClientInvoiceSummaryValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
  type ClientQuoteSummaryValue,
  type UlidValue,
} from '@froment/contracts';

import { Authentication } from '@backoffice/authentication';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';

type PageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-client-portal',
  imports: [Badge, Button, DataTable, Notice],
  templateUrl: './client-portal.html',
  styleUrl: './client-portal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPortal {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(Authentication);
  protected readonly api = inject(ClientPortalApi);
  private readonly router = inject(Router);
  protected readonly state = signal<PageState>('loading');
  protected readonly quotes = signal<ClientQuoteListValue>([]);
  protected readonly orders = signal<ClientOrderListValue>([]);
  protected readonly invoices = signal<ClientInvoiceListValue>([]);

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected money(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.i18n.language(), { style: 'currency', currency }).format(
      cents / 100,
    );
  }

  protected date(value: string): string {
    const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
    return new Intl.DateTimeFormat(this.i18n.language(), { dateStyle: 'medium' }).format(date);
  }

  protected quoteStatus(status: ClientQuoteSummaryValue['status']): string {
    return this.i18n.t(`backOffice.quote.status.${status}`);
  }

  protected invoiceStatus(status: ClientInvoiceSummaryValue['status']): string {
    return this.i18n.t(`backOffice.invoice.status.${status}`);
  }

  protected quotePdfUrl(quoteId: UlidValue): string {
    return this.api.quotePdfUrl(quoteId);
  }

  protected invoicePdfUrl(invoiceId: UlidValue): string {
    return this.api.invoicePdfUrl(invoiceId);
  }

  protected orderPdfUrl(orderId: UlidValue): string {
    return this.api.orderPdfUrl(orderId);
  }

  async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [quotes, orders, invoices] = await Promise.all([
        this.api.listQuotes(),
        this.api.listOrders(),
        this.api.listInvoices(),
      ]);
      this.quotes.set(quotes);
      this.orders.set(orders);
      this.invoices.set(invoices);
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async signOut(): Promise<void> {
    if (await this.auth.signOut()) {
      await this.router.navigateByUrl('/backoffice/login?mode=client');
    }
  }
}
