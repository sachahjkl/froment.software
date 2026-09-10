import { type EmailTestOperation } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';

export function emailTestStatusLabel(status: EmailTestOperation['status']): TranslationKey {
  return `emailTest.${status}`;
}

export function emailTestOutcomeHint(status: EmailTestOperation['status']): TranslationKey {
  if (status === 'failed' || status === 'blocked') return 'emailTest.failureHint';
  return 'emailTest.acceptedHint';
}
