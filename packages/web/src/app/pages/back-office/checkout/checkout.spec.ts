import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import type { CheckoutOperation, CheckoutRequest } from '@froment/contracts';
import { CheckoutApi } from '@backoffice/checkout-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Checkout } from './checkout';

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
const choose = (root: HTMLElement) => {
  const select = root.querySelector<HTMLSelectElement>('#checkout-invoice');
  if (select === null) throw new Error('Missing invoice selector');
  select.value = invoice.id;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
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
  choose(root);
  await fixture.whenStable();
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(calls).toHaveLength(1);
  expect(root.querySelector<HTMLSelectElement>('select')?.disabled).toBe(true);
  expect(fixture.componentInstance.canDeactivate()).toBeInstanceOf(Promise);
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(calls).toHaveLength(2);
  expect(calls[0]).toEqual(calls[1]);
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
  choose(root);
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
  const fixture = TestBed.createComponent(Checkout);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  await vi.waitFor(() =>
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(
      /Cette demande ne figure pas|This request is not/,
    ),
  );
  expect(root.querySelector('[role="status"]')?.textContent).not.toContain(invoice.invoiceNumber);
});
