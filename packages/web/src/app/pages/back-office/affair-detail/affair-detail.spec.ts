import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
import { ClientsApi } from '@backoffice/clients-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { AffairDetail, invoiceSummaryBadge } from './affair-detail';
import {
  CommercialDestination,
  control,
  detailTabs,
  orderFixture,
  quoteFixture,
  quoteId,
} from '../quote-detail/commercial.spec-helper';

describe('Affair detail', () => {
  it('distinguishes paid invoices from issued invoices in the document summary', () => {
    expect(invoiceSummaryBadge('paid')).toEqual({
      label: 'backOffice.invoice.status.paid',
      variant: 'success',
    });
    expect(invoiceSummaryBadge('issued').label).toBe('backOffice.invoice.status.issued');
  });
  let creditedCents = 0;
  const get = vi.fn();
  beforeEach(() => {
    creditedCents = 0;
    get.mockReset().mockResolvedValue({ success: true, result: quoteFixture });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'backoffice/affaires/:quoteId',
            component: AffairDetail,
            children: detailTabs('affair-detail', ['overview', 'documents', 'history']),
          },
          { path: 'list/:view', component: CommercialDestination },
        ]),
        {
          provide: QuotesApi,
          useValue: {
            get,
            listAffairEvents: async () => [
              { id: 'event', action: 'quote.sent', occurredAt: '2026-08-20T08:00:00.000Z' },
            ],
          },
        },
        {
          provide: OrdersApi,
          useValue: {
            list: async () => [{ ...orderFixture, invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAF' }],
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
                id: '01ARZ3NDEKTSV4RRFFQ69G5FAF',
                status: 'issued',
                version: 1,
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
  });
  it('separates overview, document links and audit history', async () => {
    const harness = await RouterTestingHarness.create(
      `/backoffice/affaires/${quoteId}/overview?q=Audit&view=all`,
    );
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('#timeline-title')).toBeNull();
    expect(root.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(control<HTMLAnchorElement>(root, '.back-link').getAttribute('href')).toContain(
      '/backoffice/affaires/all?q=Audit',
    );
    control<HTMLAnchorElement>(root, '#affair-documents-tab').click();
    await harness.fixture.whenStable();
    expect(root.querySelector('#documents-title')).not.toBeNull();
    expect(root.querySelector(`a[href^="/backoffice/quotes/${quoteId}?"]`)).not.toBeNull();
    expect(root.querySelector(`a[href^="/backoffice/orders/${orderFixture.id}?"]`)).not.toBeNull();
    expect(root.querySelector('a[href$="/preview"]')).not.toBeNull();
    control<HTMLAnchorElement>(root, '#affair-history-tab').click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/history?q=Audit');
    expect(root.querySelector('#timeline-title')).not.toBeNull();
    expect(root.textContent).toMatch(/signature|Signing link/i);
    expect(root.querySelector('#documents-title')).toBeNull();
  });
  it('removes the reminder for an overdue invoice covered by a credit note', async () => {
    creditedCents = 1200;
    const harness = await RouterTestingHarness.create(`/backoffice/affaires/${quoteId}`);
    await harness.fixture.whenStable();
    expect(harness.fixture.nativeElement.querySelector('#next-action-title')).not.toBeNull();
    expect(
      harness.fixture.nativeElement.querySelector(
        'a[href="/backoffice/invoices/01ARZ3NDEKTSV4RRFFQ69G5FAF"]',
      ),
    ).not.toBeNull();
    expect(harness.fixture.nativeElement.querySelector('a[href^="mailto:"]')).toBeNull();
  });
  it('keeps audit events in fixed chronological order without mutating the response', async () => {
    const events = [
      { id: 'later', action: 'quote.sent', occurredAt: '2026-02-01T08:00:00.000Z' },
      { id: 'earlier', action: 'quote.created', occurredAt: '2026-01-31T08:00:00.000Z' },
    ];
    TestBed.overrideProvider(QuotesApi, {
      useValue: { get, listAffairEvents: async () => events },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/affaires/${quoteId}/history`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(Array.from(root.querySelectorAll('time'), (time) => time.dateTime)).toEqual([
      '2026-01-31T08:00:00.000Z',
      '2026-02-01T08:00:00.000Z',
    ]);
    expect(root.querySelector('[appTableSort]')).toBeNull();
    expect(events[0]?.id).toBe('later');
  });
  it('does not display an invoice creation action when invoice loading fails', async () => {
    TestBed.overrideProvider(InvoicesApi, {
      useValue: { get: async () => ({ success: false, code: 'invoice.error' }) },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/affaires/${quoteId}`);
    await harness.fixture.whenStable();
    expect(harness.fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(
      harness.fixture.nativeElement.querySelector('a[href^="/backoffice/invoices/new"]'),
    ).toBeNull();
  });
});
