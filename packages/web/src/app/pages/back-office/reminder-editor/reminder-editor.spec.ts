import { ReminderEditor } from './reminder-editor';
import { invoiceId, setupEmailPage } from '../emails/email-workspace.spec-helper';
import { vi } from 'vitest';

function notifyDateValidity(input: HTMLInputElement): void {
  const event = new Event('animationstart');
  Object.defineProperty(event, 'animationName', { value: 'ng-valid' });
  input.dispatchEvent(event);
}

describe('ReminderEditor', () => {
  beforeEach(() => vi.setSystemTime(new Date('2026-09-10T08:00:00.000Z')));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it.each(['', `?invoice=${invoiceId}`])(
    'allows leaving unchanged values after native validity animations with query %s',
    async (query) => {
      const { harness, root, confirmation, reminders, router } = await setupEmailPage(
        `/backoffice/courriels/reminders/new${query}`,
      );
      const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
      const form = component['scheduleForm'];
      const initial = structuredClone(form().value());
      notifyDateValidity(root.querySelector<HTMLInputElement>('#reminder-date')!);
      await harness.fixture.whenStable();
      expect(form.date().dirty()).toBe(true);
      expect(form().touched()).toBe(false);
      expect(form().value()).toEqual(initial);
      expect(component['hasUnsavedChanges']()).toBe(false);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(await router.navigateByUrl('/other')).toBe(true);
      expect(confirmation.request).not.toHaveBeenCalled();
      expect(reminders.create).not.toHaveBeenCalled();
    },
  );
  it('guards incomplete native dates even when the model remains empty', async () => {
    const { harness, root, confirmation, router } = await setupEmailPage(
      `/backoffice/courriels/reminders/new?invoice=${invoiceId}`,
    );
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    const form = component['scheduleForm'];
    const initial = structuredClone(form().value());
    const date = root.querySelector<HTMLInputElement>('#reminder-date')!;
    const badInput = vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(form().value()).toEqual(initial);
    expect(form.date().errors()).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'parse' })]),
    );
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    badInput.mockRestore();
    notifyDateValidity(date);
    await harness.fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(false);
    const cleared = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleared);
    expect(cleared.defaultPrevented).toBe(false);
    expect(await router.navigateByUrl('/other')).toBe(true);
    expect(confirmation.request).toHaveBeenCalledOnce();
  });
  it('rejects native parse errors after a valid date before confirmation or API calls', async () => {
    const { harness, root, confirmation, reminders, reminderStore, fill, save } =
      await setupEmailPage(`/backoffice/courriels/reminders/new?invoice=${invoiceId}`);
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    await fill('reminder-date', '2026-10-01T10:00');
    const date = root.querySelector<HTMLInputElement>('#reminder-date')!;
    vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.value = '';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(component['scheduleForm'].date().value()).toBe('2026-10-01T10:00');
    expect(component['scheduleForm'].date().invalid()).toBe(true);
    await save();
    expect(component['error']()).toBe('emailsWorkspace.dateInvalid');
    expect(document.activeElement).toBe(date);
    expect(date.getAttribute('aria-invalid')).toBe('true');
    expect(confirmation.request).not.toHaveBeenCalled();
    expect(reminders.create).not.toHaveBeenCalled();
    expect(reminderStore.read()).toBeUndefined();
  });
  it.each(['busy', 'confirming'] as const)(
    'blocks exits while %s even without value changes',
    async (state) => {
      const { harness, root, confirmation, router } = await setupEmailPage(
        `/backoffice/courriels/reminders/new?invoice=${invoiceId}`,
      );
      const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
      component[state].set(true);
      await harness.fixture.whenStable();
      expect(component['hasUnsavedChanges']()).toBe(false);
      expect(root.querySelector<HTMLInputElement>('#reminder-date')?.disabled).toBe(true);
      expect(await router.navigateByUrl('/other')).toBe(false);
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(confirmation.request).not.toHaveBeenCalled();
    },
  );
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
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    component['choose']('');
    expect(component['model']().invoiceId).toBe(invoiceId);
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
    confirmation.request.mockResolvedValue(false);
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
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
    const { fill, router, confirmation } = await setupEmailPage(
      `/backoffice/courriels/reminders/new?invoice=${invoiceId}`,
    );
    await fill('reminder-date', '2026-10-01T10:00');
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await fill('reminder-date', '');
    const cleared = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleared);
    expect(cleared.defaultPrevented).toBe(false);
    expect(await router.navigateByUrl('/other')).toBe(true);
    expect(confirmation.request).toHaveBeenCalledOnce();
  });
  it('guards invoice changes and permits leaving after restoring the initial invoice', async () => {
    const { harness, confirmation, router } = await setupEmailPage(
      '/backoffice/courriels/reminders/new',
    );
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    component['choose'](invoiceId);
    await harness.fixture.whenStable();
    expect(await router.navigateByUrl('/other')).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    component['choose']('');
    await harness.fixture.whenStable();
    expect(await router.navigateByUrl('/other')).toBe(true);
    expect(confirmation.request).toHaveBeenCalledOnce();
  });
  it('keeps completed schedules locked without another exit warning or API call', async () => {
    const { harness, root, confirmation, reminders, reminderStore, fill, save, navigation } =
      await setupEmailPage(`/backoffice/courriels/reminders/new?invoice=${invoiceId}`);
    const component = harness.routeDebugElement!.componentInstance as ReminderEditor;
    navigation.allowList = false;
    confirmation.request.mockResolvedValueOnce(true);
    await fill('reminder-date', '2026-10-01T10:00');
    await save();
    expect(component['completed']()).toBe(true);
    expect(component['scheduleForm']().disabled()).toBe(true);
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(root.querySelector('form')).toBeNull();
    expect(reminderStore.read()).toBeUndefined();
    const saved = structuredClone(component['model']());
    component['choose']('');
    expect(component['model']()).toEqual(saved);
    await component['schedule'](new SubmitEvent('submit'));
    expect(reminders.create).toHaveBeenCalledOnce();
    expect(await component.canDeactivate()).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(confirmation.request).toHaveBeenCalledOnce();
  });
});
