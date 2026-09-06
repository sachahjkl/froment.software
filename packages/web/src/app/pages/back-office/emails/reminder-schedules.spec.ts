import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RemindersApi } from '@backoffice/reminders-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ReminderSchedules } from './reminder-schedules';

it('preserves a failed schedule, reuses its key, and clears the exit guard only after saving', async () => {
  const result = {
    id: '91ff5717-c394-4708-bef2-6b5f5cafbdaa',
    invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    expectedVersion: 2,
    expectedMode: 'simulation',
    language: 'fr',
    sendAt: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-09-06T10:00:00.000Z',
    createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    status: 'scheduled',
    reason: null,
    operationId: null,
  };
  const create = vi
    .fn()
    .mockResolvedValueOnce({ success: false, code: 'reminder.error' })
    .mockResolvedValueOnce({ success: true, result });
  TestBed.configureTestingModule({
    providers: [
      {
        provide: RemindersApi,
        useValue: { list: async () => ({ success: true, result: [] }), create },
      },
    ],
  });
  const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
  try {
    const fixture = TestBed.createComponent(ReminderSchedules);
    fixture.componentRef.setInput('invoiceId', result.invoiceId);
    fixture.componentRef.setInput('mode', 'simulation');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const date = root.querySelector<HTMLInputElement>('#reminder-date');
    if (date === null) throw new Error('reminder.date.missing');
    date.value = '2026-10-01T10:00';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.hasChanges()).toBe(true);
    const submit = () =>
      root
        .querySelector('form')
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    submit();
    await fixture.whenStable();
    expect(date.value).toBe('2026-10-01T10:00');
    expect(fixture.componentInstance.hasChanges()).toBe(true);
    submit();
    await fixture.whenStable();
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toBe(create.mock.calls[1]?.[0]);
    expect(create.mock.calls[1]?.[1]).toMatchObject({
      invoiceId: result.invoiceId,
      expectedMode: 'simulation',
      sendAt: new Date('2026-10-01T10:00').toISOString(),
    });
    expect(fixture.componentInstance.hasChanges()).toBe(false);
  } finally {
    confirmation.mockRestore();
  }
});
