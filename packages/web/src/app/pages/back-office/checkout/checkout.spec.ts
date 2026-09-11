import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { firstValueFrom, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CheckoutRequest, type CheckoutOperation } from '@froment/contracts';
import {
  PendingProviderRequests,
  pendingRequestStore,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { CheckoutApi } from '@backoffice/checkout-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Checkout } from './checkout';
import { CheckoutDetail } from './checkout-detail';

const invoice = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'issued',
  version: 2,
  invoiceNumber: 'FA-2026-000001',
  totalCents: 12500,
  recordedPaidCents: 2500,
  creditedCents: 0,
  clientDisplayName: 'Client',
};
beforeEach(() => {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: PendingProviderRequests,
        useValue: {
          checkout: async () =>
            pendingRequestStore(sessionStorage, 'checkout-test', CheckoutRequest),
        },
      },
    ],
  });
});
const operation = (request: CheckoutRequest): CheckoutOperation => ({
  request,
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  invoiceNumber: 'FA-2026-000001',
  amountCents: 10000,
  currency: 'EUR',
  mode: 'test',
  createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  createdAt: '2026-09-09T12:00:00.000Z',
  updatedAt: '2026-09-09T12:00:00.000Z',
  expiresAt: '2026-09-10T11:00:00.000Z',
  status: 'queued',
  attempts: 0,
  nextAttemptAt: '2026-09-09T12:00:03.000Z',
  sessionId: null,
  checkoutUrl: null,
  error: null,
});
const choose = (fixture: ComponentFixture<Checkout>) => {
  fixture.componentInstance['chooseInvoice'](invoice.id);
};

it('confirms creation, preserves ambiguous request identities, and never marks test payments as receipts', async () => {
  const calls: CheckoutRequest[] = [];
  const create = vi.fn(async (request: CheckoutRequest) => {
    calls.push(request);
    return calls.length === 1
      ? { success: false as const, code: 'checkout.error' as const }
      : { success: true as const, result: operation(request) };
  });
  const confirm = vi.fn(async () => true);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: CheckoutApi,
        useValue: {
          connection: async () => ({
            credentialsPresent: true,
            testKey: true,
            webhookConfigured: false,
          }),
          list: () => of([]),
          create,
        },
      },
      { provide: InvoicesApi, useValue: { list: async () => [invoice] } },
      { provide: Confirmation, useValue: { request: confirm } },
    ],
  });
  const fixture = TestBed.createComponent(Checkout);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(create).not.toHaveBeenCalled();
  choose(fixture);
  await fixture.whenStable();
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(calls).toHaveLength(1);
  expect(root.querySelector<HTMLButtonElement>('app-object-picker button')?.disabled).toBe(true);
  expect(fixture.componentInstance.canDeactivate()).toBeInstanceOf(Promise);
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
  expect(root.querySelector('form')).toBeNull();
  await fixture.componentInstance['create'](new SubmitEvent('submit'));
  expect(calls).toHaveLength(2);
  expect(Object.keys(calls[0] ?? {}).sort()).toEqual(['expectedVersion', 'invoiceId', 'requestId']);
  expect(root.querySelector('[role="status"]')?.textContent).toMatch(
    /Demande enregistrée|Request recorded/,
  );
  expect(root.textContent).toMatch(
    /ne crée aucun encaissement local|does not settle the invoice or create a local receipt/,
  );
});

it('does not overwrite a completed submission with an older polling response', async () => {
  const stale = new Subject<readonly CheckoutOperation[]>();
  const list = vi.fn(() => stale);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: CheckoutApi,
        useValue: {
          connection: async () => ({
            credentialsPresent: true,
            testKey: true,
            webhookConfigured: false,
          }),
          list,
          create: async (request: CheckoutRequest) => ({
            success: true,
            result: operation(request),
          }),
        },
      },
      { provide: InvoicesApi, useValue: { list: async () => [invoice] } },
      { provide: Confirmation, useValue: { request: async () => true } },
    ],
  });
  const fixture = TestBed.createComponent(Checkout);
  await fixture.whenStable();
  await vi.waitFor(() => expect(list).toHaveBeenCalled());
  const root: HTMLElement = fixture.nativeElement;
  choose(fixture);
  await fixture.whenStable();
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  stale.next([]);
  stale.complete();
  await fixture.whenStable();
  expect(root.querySelector('[role="status"]')?.textContent).toMatch(
    /Demande enregistrée|Request recorded/,
  );
});

it('does not replace an unknown return request with another invoice test', async () => {
  const request = {
    requestId: '7345c34c-320b-49a4-ae23-ec993e570e8b',
    invoiceId: invoice.id,
    expectedVersion: 2,
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap({ request: 'another-request' }) },
          paramMap: of(convertToParamMap({ requestId: 'another-request' })),
          queryParamMap: of(convertToParamMap({})),
        },
      },
      {
        provide: CheckoutApi,
        useValue: {
          connection: async () => ({
            credentialsPresent: true,
            testKey: true,
            webhookConfigured: false,
          }),
          list: () => of([operation(request)]),
        },
      },
      { provide: InvoicesApi, useValue: { list: async () => [invoice] } },
    ],
  });
  const fixture = TestBed.createComponent(CheckoutDetail);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  await vi.waitFor(() =>
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(
      /Cette demande ne figure pas|This request is not/,
    ),
  );
  expect(root.querySelector('[role="status"]')?.textContent).not.toContain(invoice.invoiceNumber);
});

it('reconciles durable requests even when history arrives before recovery', async () => {
  const request: CheckoutRequest = {
    requestId: '7345c34c-320b-49a4-ae23-ec993e570e8b',
    invoiceId: invoice.id,
    expectedVersion: 2,
  };
  const store = pendingRequestStore(sessionStorage, 'checkout-test', CheckoutRequest);
  store.write(request);
  const recovery = new Subject<PendingRequestStore<CheckoutRequest>>();
  const create = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PendingProviderRequests, useValue: { checkout: () => firstValueFrom(recovery) } },
      {
        provide: CheckoutApi,
        useValue: {
          connection: async () => ({
            credentialsPresent: true,
            testKey: true,
            webhookConfigured: false,
          }),
          list: () => of([operation(request)]),
          create,
        },
      },
      { provide: InvoicesApi, useValue: { list: async () => [invoice] } },
    ],
  });
  const fixture = TestBed.createComponent(Checkout);
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance['history'].loaded()).toBe(true));
  recovery.next(store);
  await vi.waitFor(() => expect(fixture.componentInstance['completed']()).toBe(true));
  expect(store.read()).toBeUndefined();
  expect(fixture.componentInstance['pending']()).toBeUndefined();
  expect(fixture.componentInstance.canDeactivate()).toBe(true);
  await fixture.componentInstance['create'](new SubmitEvent('submit'));
  expect(create).not.toHaveBeenCalled();
});

it('does not create a Stripe session without durable storage', async () => {
  const create = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: PendingProviderRequests,
        useValue: {
          checkout: async () => ({
            read: () => undefined,
            write: () => {
              throw new Error('Storage is full');
            },
            clear: () => undefined,
          }),
        },
      },
      {
        provide: CheckoutApi,
        useValue: {
          connection: async () => ({
            credentialsPresent: true,
            testKey: true,
            webhookConfigured: false,
          }),
          list: () => of([]),
          create,
        },
      },
      { provide: InvoicesApi, useValue: { list: async () => [invoice] } },
      { provide: Confirmation, useValue: { request: async () => true } },
    ],
  });
  const fixture = TestBed.createComponent(Checkout);
  await fixture.whenStable();
  choose(fixture);
  await fixture.componentInstance['create'](new SubmitEvent('submit'));
  expect(create).not.toHaveBeenCalled();
  expect(fixture.componentInstance['error']()).toBe('checkout.recoveryUnavailable');
});

it('checks a stopped session explicitly without creating a new request and preserves unknown results', async () => {
  const request: CheckoutRequest = {
    requestId: '7345c34c-320b-49a4-ae23-ec993e570e8b',
    invoiceId: invoice.id,
    expectedVersion: 2,
  };
  const stopped: CheckoutOperation = {
    ...operation(request),
    status: 'open',
    nextAttemptAt: null,
    sessionId: 'cs_test_existing',
    error: 'checkout.statusWindowExceeded',
  };
  const list = new Subject<readonly CheckoutOperation[]>();
  const create = vi.fn();
  const reconcile = vi
    .fn()
    .mockResolvedValueOnce({ success: false, code: 'checkout.error' })
    .mockResolvedValueOnce({
      success: true,
      result: { ...stopped, status: 'expired', error: null },
    });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ requestId: request.requestId })),
          queryParamMap: of(convertToParamMap({})),
        },
      },
      { provide: CheckoutApi, useValue: { list: () => list, create, reconcile } },
    ],
  });
  const fixture = TestBed.createComponent(CheckoutDetail);
  await fixture.whenStable();
  const detail = fixture.componentInstance;
  detail['history'].record(stopped);
  await detail['reconcile']();
  expect(detail['current']()).toEqual(stopped);
  expect(detail['reconcileError']()).toBe('checkout.error');
  await detail['reconcile']();
  expect(detail['current']()?.status).toBe('expired');
  expect(reconcile.mock.calls).toEqual([[request.requestId], [request.requestId]]);
  expect(create).not.toHaveBeenCalled();
  await detail['reconcile']();
  expect(reconcile).toHaveBeenCalledTimes(2);
});
