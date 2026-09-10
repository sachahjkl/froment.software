import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { type CheckoutOperation, type EmailTestOperation } from '@froment/contracts';
import { ConnectionsApi } from '@backoffice/connections-api';
import { CheckoutApi } from '@backoffice/checkout-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { PendingProviderRequests } from '@backoffice/pending-provider-requests';
import { EmailTestList } from '../email-test/email-test-list';
import { EmailTestDetail } from '../email-test/email-test-detail';
import { CheckoutList } from '../checkout/checkout-list';

describe('Provider read pages', () => {
  it('exports sorted Resend summaries without message bodies or provider identifiers', async () => {
    const operation: EmailTestOperation = {
      request: { requestId: 'request-a', subject: 'Message', body: 'Private body' },
      createdByUserId: 'private-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      status: 'delivered',
      attempts: 1,
      nextAttemptAt: null,
      providerId: 'private-provider',
      error: null,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ConnectionsApi,
          useValue: { connections: async () => [], emailTests: () => of([]) },
        },
        { provide: PendingProviderRequests, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(EmailTestList);
    await fixture.whenStable();
    fixture.componentInstance['history'].operations.set([
      {
        ...operation,
        createdAt: '2025-12-31T00:00:00.000Z',
        request: { ...operation.request, requestId: 'request-b', subject: 'Older' },
      },
      operation,
    ]);
    expect(fixture.componentInstance['testExport']()).toEqual([
      ['2026-01-01T00:00:00.000Z', 'Message', 'delivered'],
      ['2025-12-31T00:00:00.000Z', 'Older', 'delivered'],
    ]);
    expect(JSON.stringify(fixture.componentInstance['testExport']())).not.toMatch(
      /private|request-a/i,
    );
  });

  it('sorts Stripe amounts before formatting and excludes session URLs from exports', async () => {
    const params = convertToParamMap({ sort: 'amountAsc' });
    const operation: CheckoutOperation = {
      request: { requestId: 'request-a', invoiceId: 'private-invoice', expectedVersion: 1 },
      invoiceNumber: 'INV-10',
      revisionId: 'private-revision',
      amountCents: 10000,
      currency: 'EUR',
      mode: 'test',
      createdByUserId: 'private-user',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      status: 'open',
      attempts: 1,
      nextAttemptAt: null,
      sessionId: 'private-session',
      checkoutUrl: 'https://checkout.stripe.com/private',
      error: null,
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            queryParamMap: of(params),
            snapshot: { queryParamMap: params },
          },
        },
        {
          provide: CheckoutApi,
          useValue: { connection: async () => ({ testKey: true }), list: () => of([]) },
        },
        { provide: InvoicesApi, useValue: {} },
        { provide: PendingProviderRequests, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(CheckoutList);
    await fixture.whenStable();
    fixture.componentInstance['history'].operations.set([
      operation,
      {
        ...operation,
        request: { ...operation.request, requestId: 'request-b' },
        invoiceNumber: 'INV-2',
        amountCents: 2000,
      },
    ]);
    expect(fixture.componentInstance['testExport']()).toEqual([
      ['INV-2', operation.createdAt, 2000, 'open'],
      ['INV-10', operation.createdAt, 10000, 'open'],
    ]);
    expect(JSON.stringify(fixture.componentInstance['testExport']())).not.toMatch(
      /private|https:|request-a/,
    );
  });

  it('opens Resend history without a form or recovery mutation', async () => {
    const sendEmailTest = vi.fn();
    const email = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ConnectionsApi,
          useValue: { connections: async () => [], emailTests: () => of([]), sendEmailTest },
        },
        { provide: PendingProviderRequests, useValue: { email } },
      ],
    });
    const fixture = TestBed.createComponent(EmailTestList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('a[href$="new"]')).not.toBeNull();
    expect(sendEmailTest).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it('does not substitute another Resend operation for an unknown request', async () => {
    const sendEmailTest = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ requestId: 'missing' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        { provide: PendingProviderRequests, useValue: {} },
        {
          provide: ConnectionsApi,
          useValue: {
            connections: async () => [],
            emailTests: () =>
              of([
                {
                  request: { requestId: 'different', subject: 'Other message' },
                  status: 'accepted',
                },
              ]),
            sendEmailTest,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(EmailTestDetail);
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance['history'].loaded()).toBe(true));
    const root: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance['current']()).toBeUndefined();
    expect(root.textContent).not.toContain('Other message');
    expect(root.querySelector('form')).toBeNull();
    expect(sendEmailTest).not.toHaveBeenCalled();
  });

  it('opens Stripe history without loading selectable invoices or creating sessions', async () => {
    const create = vi.fn();
    const checkout = vi.fn();
    const listInvoices = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CheckoutApi,
          useValue: { connection: async () => ({ testKey: true }), list: () => of([]), create },
        },
        { provide: InvoicesApi, useValue: { list: listInvoices } },
        { provide: PendingProviderRequests, useValue: { checkout } },
      ],
    });
    const fixture = TestBed.createComponent(CheckoutList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('form')).toBeNull();
    expect(listInvoices).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(checkout).not.toHaveBeenCalled();
  });
});
