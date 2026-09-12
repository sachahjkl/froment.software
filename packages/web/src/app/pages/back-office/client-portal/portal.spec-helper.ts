import {
  type ClientInvoiceListValue,
  type ClientOrderListValue,
  type ClientQuoteListValue,
} from '@froment/contracts';

export const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
export const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
export const orderId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';

export class ClientPortalApiStub {
  calls = 0;
  fail = false;
  quotes: ClientQuoteListValue = [
    {
      id: quoteId,
      reference: 'DE-2026-000001',
      status: 'accepted',
      title: 'Security audit',
      currency: 'EUR',
      totalCents: 12000,
      updatedAt: '2026-08-20T08:00:00.000Z',
      pdfAvailable: true,
    },
  ];
  orders: ClientOrderListValue = [
    {
      id: orderId,
      reference: 'CO-2026-000001',
      quoteId,
      quoteReference: 'DE-2026-000001',
      status: 'confirmed',
      title: 'Security audit',
      currency: 'EUR',
      totalCents: 12000,
      createdAt: '2026-08-20T08:00:00.000Z',
      invoiceId,
      pdfAvailable: true,
    },
  ];
  invoices: ClientInvoiceListValue = [
    {
      recordedPaidCents: 3000,
      creditedCents: 0,
      remainingCents: 9000,
      id: invoiceId,
      orderId,
      orderReference: 'CO-2026-000001',
      status: 'issued',
      invoiceNumber: 'FA-2026-000001',
      title: 'Security audit',
      dueDate: '2026-09-20',
      currency: 'EUR',
      totalCents: 12000,
      updatedAt: '2026-08-20T08:00:00.000Z',
      pdfAvailable: false,
      creditNotes: [],
    },
  ];
  listQuotes(): Promise<ClientQuoteListValue> {
    this.calls += 1;
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.quotes);
  }
  listOrders(): Promise<ClientOrderListValue> {
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.orders);
  }
  listInvoices(): Promise<ClientInvoiceListValue> {
    return this.fail ? Promise.reject(new Error('Unavailable')) : Promise.resolve(this.invoices);
  }
  quotePdfUrl(id: string): string {
    return `/api/client/quotes/${id}/pdf`;
  }
  invoicePdfUrl(id: string): string {
    return `/api/client/invoices/${id}/pdf`;
  }
  orderPdfUrl(id: string): string {
    return `/api/client/orders/${id}/pdf`;
  }
}
