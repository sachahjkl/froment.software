import { describe, expect, it } from 'vitest';
import { reminderErrorMessage } from './reminder-error-message';

describe('reminder error messages', () => {
  it.each([
    ['load', 'reminder.loadError'],
    ['schedule', 'reminder.scheduleUnconfirmed'],
    ['cancel', 'reminder.cancelUnconfirmed'],
  ] as const)(
    'names the %s operation without resolving an uncertain request',
    (operation, message) => {
      expect(reminderErrorMessage('reminder.error', operation)).toBe(message);
      expect(reminderErrorMessage('reminder.conflict', operation)).toBe('reminder.conflict');
      expect(reminderErrorMessage('authentication.permission_denied', operation)).toBe(
        'authentication.permission_denied',
      );
      expect(reminderErrorMessage(undefined, operation)).toBeUndefined();
    },
  );
});
