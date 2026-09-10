import { type QuoteStatusValue } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { type ButtonVariant } from '@shared/button/button';

interface QuoteEditAction {
  readonly label: TranslationKey;
  readonly variant: ButtonVariant;
}

export function quoteEditAction(status: QuoteStatusValue): QuoteEditAction | undefined {
  if (status === 'draft') return { label: 'commercial.edit', variant: 'default' };
  if (status === 'expired') return { label: 'commercial.revise', variant: 'primary' };
  return undefined;
}

export function canCancelQuote(status: QuoteStatusValue): boolean {
  return status === 'draft' || status === 'sent' || status === 'expired';
}
