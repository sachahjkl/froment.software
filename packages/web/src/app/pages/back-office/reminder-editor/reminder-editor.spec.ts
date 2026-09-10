import { ReminderEditor } from './reminder-editor';
import { invoiceId, setupEmailPage } from '../emails/email-workspace.spec-helper';
import { vi } from 'vitest';

describe('ReminderEditor', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-09-10T08:00:00.000Z')));
  afterEach(() => vi.useRealTimers());
  it('restores uncertain schedules without changing their invoice version or resubmitting automatically', async () => {
    const { reminderStore, router, harness, reminders, invoices, root, confirmation } =
      await setupEmailPage('/other');
    const pending = {
      requestId: '91ff5717-c394-4708-bef2-6b5f5cafbdab',
      request: {
        invoiceId,
        expectedVersion: 1,
        expectedMode: 'simulation' as const,
        language: 'fr' as const,
        sendAt: '2026-10-01T10:00:00.000Z',
      },
    };
    reminderStore.write(pending);
    await router.navigateByUrl('/backoffice/courriels/reminders/new');
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#reminder-date')?.disabled).toBe(true);
    expect(reminders.create).not.toHaveBeenCalled();
    confirmation.request.mockResolvedValue(true);
    await router.navigateByUrl('/other');
    invoices.list.mockResolvedValue([]);
    await router.navigateByUrl('/backoffice/courriels/reminders/new');
    await harness.fixture.whenStable();
    await (harness.routeDebugElement!.componentInstance as ReminderEditor)['retry']();
    expect(reminders.create).toHaveBeenCalledExactlyOnceWith(pending.requestId, pending.request);
    expect(reminderStore.read()).toBeUndefined();
  });
  it('freezes uncertain schedules and retries the same request after failure', async () => {
    const { reminders, confirmation, root, fill, save, router } = await setupEmailPage(
      `/backoffice/courriels/reminders/new?invoice=${invoiceId}`,
    );
    reminders.create.mockResolvedValueOnce({ success: false, code: 'reminder.error' });
    confirmation.request.mockResolvedValue(true);
    await fill('reminder-date', '2026-10-01T10:00');
    await save();
    expect(root.querySelector<HTMLInputElement>('#reminder-date')?.disabled).toBe(true);
    await save();
    expect(reminders.create.mock.calls[1]).toEqual(reminders.create.mock.calls[0]);
    expect(router.url).toBe('/backoffice/courriels/reminders');
  });
  it('rejects missing invoices and invalid dates before writing', async () => {
    const { reminders, root, fill, save, harness } = await setupEmailPage(
      '/backoffice/courriels/reminders/new',
    );
    await save();
    expect(document.activeElement).toBe(root.querySelector('app-object-picker button'));
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    component['choose'](invoiceId);
    await fill('reminder-date', '2020-01-01T10:00');
    await save();
    expect(document.activeElement?.id).toBe('reminder-date');
    expect(reminders.create).not.toHaveBeenCalled();
    await fill('reminder-date', '2028-01-01T10:00');
    await save();
    expect(document.activeElement?.id).toBe('reminder-date');
    expect(reminders.create).not.toHaveBeenCalled();
  });
  it('keeps dirty schedules when exit confirmation is declined', async () => {
    const { fill, router } = await setupEmailPage(
      `/backoffice/courriels/reminders/new?invoice=${invoiceId}`,
    );
    await fill('reminder-date', '2026-10-01T10:00');
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
