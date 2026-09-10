import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EmailTestRequest, type EmailTestOperation } from '@froment/contracts';
import { firstValueFrom, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ConnectionsApi } from '@backoffice/connections-api';
import {
  PendingProviderRequests,
  pendingRequestStore,
  type PendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { Confirmation } from '@shared/confirmation/confirmation';
import { EmailTest } from './email-test';

const store = () => pendingRequestStore(sessionStorage, 'email-test', EmailTestRequest);
const operation = (request: EmailTestRequest): EmailTestOperation => ({
  request,
  createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  createdAt: '2026-09-09T12:00:00.000Z',
  updatedAt: '2026-09-09T12:00:00.000Z',
  status: 'accepted',
  attempts: 1,
  nextAttemptAt: null,
  providerId: '13d1635c-64c8-4078-b0f5-d936fb3791dd',
  error: null,
});
const connections = async () => [
  { provider: 'resend', credentialsPresent: true, missingSecrets: [], mode: 'restricted-test' },
];
beforeEach(() => {
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PendingProviderRequests, useValue: { email: async () => store() } },
      { provide: Confirmation, useValue: { request: async () => true } },
    ],
  });
});

it('restores an uncertain request after reload and resubmits only after confirmation with the same content', async () => {
  const send = vi.fn(async (request: EmailTestRequest) =>
    send.mock.calls.length === 1
      ? { success: false as const, code: 'emailTest.error' as const }
      : { success: true as const, result: operation(request) },
  );
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ConnectionsApi,
        useValue: { connections, emailTests: () => of([]), sendEmailTest: send },
      },
    ],
  });
  const first = TestBed.createComponent(EmailTest);
  await first.whenStable();
  await vi.waitFor(() => expect(first.componentInstance['history'].loading()).toBe(false));
  const root: HTMLElement = first.nativeElement;
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await first.whenStable();
  const pending = store().read();
  expect(pending).toBeDefined();
  first.destroy();
  const restored = TestBed.createComponent(EmailTest);
  await restored.whenStable();
  const restoredRoot: HTMLElement = restored.nativeElement;
  expect(restoredRoot.querySelector<HTMLInputElement>('#email-test-subject')?.value).toBe(
    pending?.subject,
  );
  expect(restoredRoot.querySelector<HTMLInputElement>('#email-test-subject')?.readOnly).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
  const unload = new Event('beforeunload', { cancelable: true });
  restored.componentInstance['beforeUnload'](unload);
  expect(unload.defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(restored.componentInstance['history'].loading()).toBe(false));
  restoredRoot.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await restored.whenStable();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0]?.[0]).toEqual(send.mock.calls[1]?.[0]);
  expect(store().read()).toBeUndefined();
  expect(restoredRoot.querySelector('form')).toBeNull();
  restored.componentInstance['send'](new SubmitEvent('submit'));
  expect(send).toHaveBeenCalledTimes(2);
  expect(restoredRoot.querySelector('[role="status"]')?.textContent).toMatch(
    /Accepté par Resend|Accepted by Resend/,
  );
});

it('reconciles a restored request from server history without sending it again', async () => {
  const request = {
    requestId: '65b77a72-e172-42f3-94bb-e0c72e733c91',
    subject: 'Test',
    body: 'Saved content',
  };
  store().write(request);
  const send = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ConnectionsApi,
        useValue: { connections, emailTests: () => of([operation(request)]), sendEmailTest: send },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmailTest);
  await fixture.whenStable();
  await vi.waitFor(() => expect(store().read()).toBeUndefined());
  expect(send).not.toHaveBeenCalled();
  expect(fixture.componentInstance['pending']()).toBeUndefined();
  fixture.componentInstance['send'](new SubmitEvent('submit'));
  expect(send).not.toHaveBeenCalled();
});

it('rejects polling data started before a new submission', async () => {
  const stale = new Subject<readonly EmailTestOperation[]>();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ConnectionsApi,
        useValue: {
          connections,
          emailTests: () => stale,
          sendEmailTest: async (request: EmailTestRequest) => ({
            success: true,
            result: operation(request),
          }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmailTest);
  await fixture.whenStable();
  await vi.waitFor(() => expect(stale.observed).toBe(true));
  stale.next([]);
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  stale.next([]);
  stale.complete();
  await fixture.whenStable();
  expect(root.querySelector('[role="status"]')?.textContent).toMatch(
    /Accepté par Resend|Accepted by Resend/,
  );
});

it('does not send when the pending request cannot be persisted', async () => {
  const send = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ConnectionsApi,
        useValue: { connections, emailTests: () => of([]), sendEmailTest: send },
      },
      {
        provide: PendingProviderRequests,
        useValue: {
          email: async () => ({
            read: () => undefined,
            write: () => {
              throw new Error('Storage is full');
            },
            clear: () => undefined,
          }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmailTest);
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance['history'].loading()).toBe(false));
  const root: HTMLElement = fixture.nativeElement;
  root.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await fixture.whenStable();
  expect(send).not.toHaveBeenCalled();
  expect(root.querySelector('[role="alert"]')?.textContent).toMatch(
    /reprise locale est indisponible|Local recovery is unavailable/,
  );
});

it('reconciles durable requests when history arrives before recovery', async () => {
  const request: EmailTestRequest = {
    requestId: '65b77a72-e172-42f3-94bb-e0c72e733c91',
    subject: 'Saved subject',
    body: 'Saved content',
  };
  store().write(request);
  const recovery = new Subject<PendingRequestStore<EmailTestRequest>>();
  const sendEmailTest = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: PendingProviderRequests, useValue: { email: () => firstValueFrom(recovery) } },
      {
        provide: ConnectionsApi,
        useValue: {
          connections,
          emailTests: () => of([operation(request)]),
          sendEmailTest,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EmailTest);
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance['history'].loaded()).toBe(true));
  recovery.next(store());
  await vi.waitFor(() => expect(fixture.componentInstance['completed']()).toBe(true));
  expect(store().read()).toBeUndefined();
  expect(fixture.componentInstance['pending']()).toBeUndefined();
  expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  fixture.componentInstance['send'](new SubmitEvent('submit'));
  expect(sendEmailTest).not.toHaveBeenCalled();
});
