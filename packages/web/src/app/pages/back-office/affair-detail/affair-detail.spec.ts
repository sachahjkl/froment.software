import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { AffairDetail } from './affair-detail';

describe('AffairDetail reminders', () => {
  it('removes the reminder link for an overdue invoice covered by a credit note', async () => {
    const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    let creditedCents = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ quoteId: id }) } },
        },
        {
          provide: QuotesApi,
          useValue: {
            get: async () => ({ success: true, result: { id, clientId: id, revisions: [] } }),
            listAffairEvents: async () => [],
          },
        },
        {
          provide: OrdersApi,
          useValue: {
            list: async () => [
              { id, quoteId: id, invoiceId: id, createdAt: '2020-01-01T00:00:00.000Z' },
            ],
          },
        },
        {
          provide: ClientsApi,
          useValue: {
            get: async () => ({
              success: true,
              result: { displayName: 'Client', email: 'client@example.test' },
            }),
          },
        },
        {
          provide: InvoicesApi,
          useValue: {
            get: async () => ({
              success: true,
              result: {
                id,
                status: 'issued',
                creditedCents,
                invoiceNumber: 'FA-2020-000001',
                currentRevision: { dueDate: '2020-01-01' },
                revisions: [],
              },
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AffairDetail);
    await fixture.componentInstance['load']();
    expect(fixture.componentInstance['invoiceReminderHref']()).toContain(
      'mailto:client@example.test',
    );
    creditedCents = 1200;
    await fixture.componentInstance['load']();
    expect(fixture.componentInstance['invoiceReminderHref']()).toBeUndefined();
  });
});
