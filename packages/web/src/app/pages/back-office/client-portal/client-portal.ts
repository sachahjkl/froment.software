import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  Ulid,
  type ClientInvoiceListValue,
  type ClientInvoiceSummaryValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
  type ClientQuoteSummaryValue,
  type UlidValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientPortalApi } from '@backoffice/client-portal-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';

type PageState = 'loading' | 'ready' | 'error';
type DocumentKind = 'quote' | 'order' | 'invoice';

interface PortalTarget {
  readonly kind: DocumentKind;
  readonly id: UlidValue;
}

@Component({
  selector: 'app-client-portal',
  imports: [Badge, Button, DataTable, Notice],
  templateUrl: './client-portal.html',
  styleUrl: './client-portal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientPortal {
  protected readonly i18n = inject(I18nService);
  protected readonly api = inject(ClientPortalApi);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  protected readonly state = signal<PageState>('loading');
  protected readonly quotes = signal<ClientQuoteListValue>([]);
  protected readonly orders = signal<ClientOrderListValue>([]);
  protected readonly invoices = signal<ClientInvoiceListValue>([]);
  private readonly target = this.readTarget();
  private focusedTarget = false;

  constructor() {
    afterNextRender(() => void this.load());
    afterRenderEffect({
      write: () => {
        if (this.state() !== 'ready' || this.target === undefined || this.focusedTarget) return;
        const row = this.document.getElementById(this.rowId(this.target.kind, this.target.id));
        if (row === null) return;
        row.scrollIntoView?.({ block: 'center' });
        row.focus({ preventScroll: true });
        this.focusedTarget = true;
      },
    });
  }

  protected rowId(kind: DocumentKind, id: UlidValue): string {
    return `client-${kind}-${id}`;
  }

  protected isTarget(kind: DocumentKind, id: UlidValue): boolean {
    return this.target?.kind === kind && this.target.id === id;
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

  private readTarget(): PortalTarget | undefined {
    for (const kind of ['quote', 'order', 'invoice'] as const) {
      const id = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.queryParamMap.get(kind));
      if (Option.isSome(id)) return { kind, id: id.value };
    }
    return undefined;
  }
}
