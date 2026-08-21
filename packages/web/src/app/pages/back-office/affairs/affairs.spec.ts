import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  type InvoiceSummaryValue,
  type OrderSummaryValue,
  type QuoteSummaryValue,
} from '@froment/contracts';
import { vi } from 'vitest';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { Affairs } from './affairs';

const draftQuote = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  reference: 'DE-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  clientDisplayName: 'Acme',
  status: 'draft',
  version: 1,
  title: 'Audit',
  currency: 'EUR',
  totalCents: 120_000,
  updatedAt: '2026-08-20T10:00:00.000Z',
} as QuoteSummaryValue;

const acceptedQuote = {
  ...draftQuote,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAC',
  reference: 'DE-2026-000002',
  status: 'accepted',
  title: 'Développement',
} as QuoteSummaryValue;

const order = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAD',
  reference: 'CO-2026-000001',
  quoteId: acceptedQuote.id,
  quoteReference: acceptedQuote.reference,
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAE',
  clientId: acceptedQuote.clientId,
  clientDisplayName: acceptedQuote.clientDisplayName,
  title: acceptedQuote.title,
  currency: 'EUR',
  totalCents: acceptedQuote.totalCents,
  createdAt: '2026-08-20T11:00:00.000Z',
  invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAF',
} as OrderSummaryValue;

const invoice = {
  id: order.invoiceId,
  orderId: order.id,
  orderReference: order.reference,
  clientId: order.clientId,
  clientDisplayName: order.clientDisplayName,
  status: 'paid',
  version: 1,
  invoiceNumber: 'FA-2026-000001',
  title: order.title,
  currency: 'EUR',
  totalCents: order.totalCents,
  updatedAt: '2026-08-21T10:00:00.000Z',
  pdf: null,
} as InvoiceSummaryValue;

describe('Affairs', () => {
  it('groups the quote, order, and invoice into one business workflow', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ClientsApi,
          useValue: {
            list: () => Promise.resolve([{ id: draftQuote.clientId, archived: false }]),
          },
        },
        {
          provide: QuotesApi,
          useValue: { list: () => Promise.resolve([draftQuote, acceptedQuote]) },
        },
        { provide: OrdersApi, useValue: { list: () => Promise.resolve([order]) } },
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([invoice]) } },
      ],
    });
    const fixture = TestBed.createComponent(Affairs);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    await vi.waitFor(() => expect(root.textContent).not.toMatch(/Loading engagements|Chargement/));
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.textContent).not.toContain('DE-2026-000002');

    root.querySelector<HTMLButtonElement>('#affairs-completed-tab')?.click();
    await fixture.whenStable();
    expect(root.textContent).toContain('DE-2026-000002');
    expect(root.textContent).toMatch(/Réglée|Paid/);
  });
});
