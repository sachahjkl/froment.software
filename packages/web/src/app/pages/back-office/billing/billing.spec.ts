import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type InvoiceSummaryValue } from '@froment/contracts';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { Billing } from './billing';

const invoice = (status: 'issued' | 'paid', suffix: string): InvoiceSummaryValue =>
  ({
    id: `01ARZ3NDEKTSV4RRFFQ69G5F${suffix}`,
    orderId: `01ARZ3NDEKTSV4RRFFQ69G5E${suffix}`,
    orderReference: `CO-2026-00000${suffix}`,
    clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
    clientDisplayName: 'Acme',
    status,
    version: 1,
    invoiceNumber: `FA-2026-00000${suffix}`,
    title: `Facture ${suffix}`,
    dueDate: '2026-09-21',
    currency: 'EUR',
    totalCents: Number(suffix) * 10_000,
    updatedAt: '2026-08-21T10:00:00.000Z',
    pdf: null,
  }) as InvoiceSummaryValue;

describe('Billing', () => {
  it('starts with outstanding invoices and exposes paid invoices in their tab', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InvoicesApi,
          useValue: { list: () => Promise.resolve([invoice('issued', '1'), invoice('paid', '2')]) },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(Billing);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('tbody')?.textContent).toContain('FA-2026-000001');
    expect(root.querySelector('tbody')?.textContent).not.toContain('FA-2026-000002');

    root.querySelector<HTMLButtonElement>('#billing-paid-tab')?.click();
    await fixture.whenStable();
    expect(root.querySelector('tbody')?.textContent).toContain('FA-2026-000002');
  });
});
