import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  ClientInvoiceList,
  ClientOrderList,
  ClientQuoteList,
  type ClientInvoiceListValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClientPortalApi {
  private readonly http = inject(HttpClient);

  async listQuotes(): Promise<ClientQuoteListValue> {
    return Schema.decodeUnknownSync(ClientQuoteList)(
      await firstValueFrom(this.http.get<unknown>('/api/client/quotes')),
    );
  }

  async listOrders(): Promise<ClientOrderListValue> {
    return Schema.decodeUnknownSync(ClientOrderList)(
      await firstValueFrom(this.http.get<unknown>('/api/client/orders')),
    );
  }

  async listInvoices(): Promise<ClientInvoiceListValue> {
    return Schema.decodeUnknownSync(ClientInvoiceList)(
      await firstValueFrom(this.http.get<unknown>('/api/client/invoices')),
    );
  }

  quotePdfUrl(quoteId: UlidValue): string {
    return `/api/client/quotes/${quoteId}/pdf`;
  }

  invoicePdfUrl(invoiceId: UlidValue): string {
    return `/api/client/invoices/${invoiceId}/pdf`;
  }

  orderPdfUrl(orderId: UlidValue): string {
    return `/api/client/orders/${orderId}/pdf`;
  }
}
