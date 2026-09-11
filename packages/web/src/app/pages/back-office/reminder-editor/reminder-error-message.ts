import type { TranslationKey } from '@froment/l10n';

export function reminderErrorMessage(
  code: TranslationKey | undefined,
  operation: 'load' | 'schedule' | 'cancel',
): TranslationKey | undefined {
  if (code !== 'reminder.error') return code;
  switch (operation) {
    case 'load':
      return 'reminder.loadError';
    case 'schedule':
      return 'reminder.scheduleUnconfirmed';
    case 'cancel':
      return 'reminder.cancelUnconfirmed';
  }
}
