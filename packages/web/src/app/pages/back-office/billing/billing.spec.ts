import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type InvoiceSummaryValue } from '@froment/contracts';
import { vi } from 'vitest';

import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { Billing } from './billing';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';

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
  it('warns seven days before an issued invoice is due', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InvoicesApi, useValue: { list: () => Promise.resolve([]) } },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const component = TestBed.createComponent(Billing).componentInstance;

    expect(component['dueVariant']('issued', '2026-09-21')).toBe('warning');
    expect(component['dueLabel']('issued', '2026-09-21')).toMatch(/proche|soon/i);
    expect(component['dueVariant']('issued', '2026-09-22')).toBe('default');
    expect(component['dueVariant']('issued', '2026-09-13')).toBe('danger');
    expect(component['dueVariant']('paid', '2026-09-21')).toBe('default');

    vi.useRealTimers();
  });

  it('starts with outstanding invoices and exposes paid invoices in their tab', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: Billing,
            children: [
              {
                path: 'issued',
                component: TabPanelOutlet,
                data: { panel: 'billing', tab: 'issued' },
              },
              { path: 'paid', component: TabPanelOutlet, data: { panel: 'billing', tab: 'paid' } },
            ],
          },
        ]),
        {
          provide: InvoicesApi,
          useValue: { list: () => Promise.resolve([invoice('issued', '1'), invoice('paid', '2')]) },
        },
        { provide: ClientsApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const harness = await RouterTestingHarness.create('/issued');
    const root: HTMLElement = harness.fixture.nativeElement;
    await vi.waitFor(() => expect(root.querySelector('tbody')).not.toBeNull());

    expect(root.querySelector('tbody')?.textContent).toContain('FA-2026-000001');
    expect(root.querySelector('tbody')?.textContent).not.toContain('FA-2026-000002');

    root.querySelector<HTMLAnchorElement>('#billing-paid-tab')?.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('tbody')?.textContent).toContain('FA-2026-000002');
  });
});
