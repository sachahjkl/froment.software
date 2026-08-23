import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Ulid,
  type ClientSummaryValue,
  type AuditEventValue,
  type InvoiceDetailValue,
  type InvoiceStatusValue,
  type OrderSummaryValue,
  type QuoteDetailValue,
  type QuoteStatusValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Icon } from '@shared/icon/icon';
import { Notice } from '@shared/notice/notice';
import { TextCopy } from '@shared/text-copy';

interface TimelineItem {
  readonly id: string;
  readonly date: string;
  readonly label: TranslationKey;
}

type PortalDocumentKind = 'quote' | 'order' | 'invoice';

@Component({
  selector: 'app-affair-detail',
  imports: [Badge, Button, DataTable, Icon, Notice, RouterLink],
  templateUrl: './affair-detail.html',
  styleUrl: './affair-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffairDetail {
  protected readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly quotesApi = inject(QuotesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly clientsApi = inject(ClientsApi);
  private readonly textCopy = inject(TextCopy);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly quote = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly order = signal<OrderSummaryValue | undefined>(undefined);
  protected readonly invoice = signal<InvoiceDetailValue | undefined>(undefined);
  protected readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly timeline = signal<readonly TimelineItem[]>([]);
  protected readonly copiedPortalLink = signal('');

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
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected quoteStatus(status: QuoteStatusValue): string {
    return this.i18n.t(`backOffice.quote.status.${status}`);
  }

  protected invoiceStatus(status: InvoiceStatusValue): string {
    return this.i18n.t(`backOffice.invoice.status.${status}`);
  }

  protected quoteNextAction(status: QuoteStatusValue): string {
    return this.i18n.t(`backOffice.affair.nextAction.quote.${status}`);
  }

  protected invoiceNextAction(status: InvoiceStatusValue): string {
    return this.i18n.t(`backOffice.affair.nextAction.invoice.${status}`);
  }

  protected quoteReminderHref(): string | undefined {
    const quote = this.quote();
    const client = this.client();
    if (quote?.status !== 'sent' || !client?.email) return undefined;
    return this.mailto(
      client.email,
      this.i18n.tf('backOffice.affair.reminder.quoteSubject', { reference: quote.reference }),
      this.i18n.tf('backOffice.affair.reminder.quoteBody', {
        name: client.displayName,
        reference: quote.reference,
        url: this.portalUrl('quote', quote.id),
      }),
    );
  }

  protected invoiceReminderHref(): string | undefined {
    const invoice = this.invoice();
    const client = this.client();
    if (
      invoice?.status !== 'issued' ||
      !client?.email ||
      invoice.currentRevision.dueDate >= new Date().toISOString().slice(0, 10)
    ) {
      return undefined;
    }
    const reference = invoice.invoiceNumber ?? invoice.orderReference;
    return this.mailto(
      client.email,
      this.i18n.tf('backOffice.affair.reminder.invoiceSubject', { reference }),
      this.i18n.tf('backOffice.affair.reminder.invoiceBody', {
        name: client.displayName,
        reference,
        dueDate: invoice.currentRevision.dueDate,
        url: this.portalUrl('invoice', invoice.id),
      }),
    );
  }

  protected portalUrl(kind: PortalDocumentKind, id: string): string {
    const url = new URL('/backoffice/client', this.document.location?.origin ?? 'http://localhost');
    url.searchParams.set(kind, id);
    return url.toString();
  }

  protected async copyPortalUrl(kind: PortalDocumentKind, id: string): Promise<void> {
    if (await this.textCopy.copy(this.portalUrl(kind, id))) {
      this.copiedPortalLink.set(`${kind}-${id}`);
    }
  }

  protected portalCopyLabel(kind: PortalDocumentKind, id: string): string {
    return this.i18n.t(
      this.copiedPortalLink() === `${kind}-${id}`
        ? 'backOffice.affair.portalLinkCopied'
        : 'backOffice.affair.copyPortalLink',
    );
  }

  protected async load(): Promise<void> {
    const quoteId = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('quoteId'));
    if (Option.isNone(quoteId)) {
      this.state.set('error');
      return;
    }
    this.state.set('loading');
    try {
      const [quoteOutcome, orders, events] = await Promise.all([
        this.quotesApi.get(quoteId.value),
        this.ordersApi.list(),
        this.quotesApi.listAffairEvents(quoteId.value),
      ]);
      if (!quoteOutcome.success) {
        this.state.set('error');
        return;
      }
      const quote = quoteOutcome.result;
      const order = orders.find((candidate) => candidate.quoteId === quote.id);
      const clientOutcome = await this.clientsApi.get(quote.clientId);
      let invoice: InvoiceDetailValue | undefined;
      if (order?.invoiceId) {
        const invoiceOutcome = await this.invoicesApi.get(order.invoiceId);
        if (invoiceOutcome.success) invoice = invoiceOutcome.result;
      }
      this.quote.set(quote);
      this.order.set(order);
      this.invoice.set(invoice);
      if (clientOutcome.success) this.client.set(clientOutcome.result);
      this.timeline.set(
        events.length === 0
          ? this.makeTimeline(quote, order, invoice)
          : events.map((event) => this.eventTimelineItem(event)),
      );
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  private makeTimeline(
    quote: QuoteDetailValue,
    order: OrderSummaryValue | undefined,
    invoice: InvoiceDetailValue | undefined,
  ): readonly TimelineItem[] {
    const items: TimelineItem[] = quote.revisions.map((revision) => ({
      id: `quote-${revision.id}`,
      date: revision.createdAt,
      label:
        revision.version === 1
          ? 'backOffice.affair.timeline.quoteCreated'
          : 'backOffice.affair.timeline.quoteRevised',
    }));
    if (order) {
      items.push({
        id: `order-${order.id}`,
        date: order.createdAt,
        label: 'backOffice.affair.timeline.orderConfirmed',
      });
    }
    if (invoice) {
      for (const revision of invoice.revisions) {
        items.push({
          id: `invoice-${revision.id}`,
          date: revision.createdAt,
          label:
            revision.version === 1
              ? 'backOffice.affair.timeline.invoiceCreated'
              : 'backOffice.affair.timeline.invoiceRevised',
        });
      }
      if (invoice.issuedAt) {
        items.push({
          id: 'invoice-issued',
          date: invoice.issuedAt,
          label: 'backOffice.affair.timeline.invoiceIssued',
        });
      }
      if (invoice.paidAt) {
        items.push({
          id: 'invoice-paid',
          date: invoice.paidAt,
          label: 'backOffice.affair.timeline.invoicePaid',
        });
      }
      if (invoice.voidedAt) {
        items.push({
          id: 'invoice-voided',
          date: invoice.voidedAt,
          label: 'backOffice.affair.timeline.invoiceVoided',
        });
      }
    }
    return items.sort((left, right) => left.date.localeCompare(right.date));
  }

  private mailto(email: string, subject: string, body: string): string {
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  private eventTimelineItem(event: AuditEventValue): TimelineItem {
    let label: TranslationKey = 'backOffice.affair.timeline.event';
    if (event.action === 'quote.created') label = 'backOffice.affair.timeline.quoteCreated';
    if (event.action === 'quote.revised') label = 'backOffice.affair.timeline.quoteRevised';
    if (event.action === 'quote.sent') label = 'backOffice.affair.timeline.quoteSent';
    if (event.action === 'quote.accepted') label = 'backOffice.affair.timeline.orderConfirmed';
    if (event.action === 'quote.expired') label = 'backOffice.affair.timeline.quoteExpired';
    if (event.action === 'quote.cancelled') label = 'backOffice.affair.timeline.quoteCancelled';
    if (event.action === 'invoice.created') label = 'backOffice.affair.timeline.invoiceCreated';
    if (event.action === 'invoice.revised') label = 'backOffice.affair.timeline.invoiceRevised';
    if (event.action === 'invoice.issued') label = 'backOffice.affair.timeline.invoiceIssued';
    if (event.action === 'invoice.marked-paid') label = 'backOffice.affair.timeline.invoicePaid';
    if (event.action === 'invoice.voided') label = 'backOffice.affair.timeline.invoiceVoided';
    return {
      id: event.id,
      date: event.occurredAt,
      label,
    };
  }
}
