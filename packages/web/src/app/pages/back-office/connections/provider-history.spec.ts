import { TestBed } from '@angular/core/testing';
import { type Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { type CheckoutOperation, type EmailTestOperation } from '@froment/contracts';
import { CheckoutApi } from '@backoffice/checkout-api';
import { ConnectionsApi } from '@backoffice/connections-api';
import { CheckoutHistory } from '../checkout/checkout-history';
import { EmailTestHistory } from '../email-test/email-test-history';

const histories = [
  { name: 'Stripe', create: () => TestBed.inject(CheckoutHistory) },
  { name: 'Resend', create: () => TestBed.inject(EmailTestHistory) },
];

const subscribe = (history: CheckoutHistory | EmailTestHistory, blocked = () => false) => {
  const updates: Observable<readonly (CheckoutOperation | EmailTestOperation)[]> =
    history.watch(blocked);
  return updates.subscribe();
};

describe.each(histories)('$name history', ({ create }) => {
  const checkoutList = vi.fn(() => new Subject<readonly CheckoutOperation[]>());
  const emailList = vi.fn(() => new Subject<readonly EmailTestOperation[]>());

  beforeEach(() => {
    vi.useFakeTimers();
    checkoutList.mockClear();
    emailList.mockClear();
    TestBed.configureTestingModule({
      providers: [
        CheckoutHistory,
        EmailTestHistory,
        { provide: CheckoutApi, useValue: { list: checkoutList } },
        { provide: ConnectionsApi, useValue: { emailTests: emailList } },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const response = () =>
    checkoutList.mock.results.at(-1)?.value ?? emailList.mock.results.at(-1)?.value;
  const count = () => checkoutList.mock.calls.length + emailList.mock.calls.length;

  it('pauses after a history error and resumes only on request', () => {
    const history = create();
    const subscription = subscribe(history);
    vi.advanceTimersByTime(0);
    response()?.next([]);
    expect(history.loaded()).toBe(true);
    response()?.error(new Error('History unavailable'));
    expect(history.paused()).toBe(true);
    vi.advanceTimersByTime(9000);
    expect(count()).toBe(1);
    history.refresh();
    vi.advanceTimersByTime(3000);
    expect(count()).toBe(2);
    response()?.next([]);
    expect(history.paused()).toBe(false);
    expect(history.loading()).toBe(false);
    subscription.unsubscribe();
  });

  it('ignores responses and errors that predate a submission', () => {
    const history = create();
    const subscription = subscribe(history);
    vi.advanceTimersByTime(0);
    history.invalidate();
    response()?.next([]);
    response()?.error(new Error('Stale error'));
    expect(history.loaded()).toBe(false);
    expect(history.paused()).toBe(false);
    subscription.unsubscribe();
  });

  it('leaves polling ownership with the screen', () => {
    const history = create();
    let saving = true;
    const subscription = subscribe(history, () => saving);
    vi.advanceTimersByTime(0);
    expect(count()).toBe(0);
    saving = false;
    vi.advanceTimersByTime(3000);
    expect(count()).toBe(1);
    subscription.unsubscribe();
    expect(response()?.observed).toBe(false);
    vi.advanceTimersByTime(9000);
    expect(count()).toBe(1);
  });
});
