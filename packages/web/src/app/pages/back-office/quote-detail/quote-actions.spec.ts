import { type QuoteStatusValue } from '@froment/contracts';
import { canCancelQuote, quoteEditAction } from './quote-actions';

describe('Quote actions', () => {
  it('offers draft editing and expired quote revision as different actions', () => {
    expect(quoteEditAction('draft')).toEqual({ label: 'commercial.edit', variant: 'default' });
    expect(quoteEditAction('expired')).toEqual({ label: 'commercial.revise', variant: 'primary' });
  });

  it.each<QuoteStatusValue>(['sent', 'accepted', 'cancelled'])(
    'does not edit a %s quote',
    (status) => {
      expect(quoteEditAction(status)).toBeUndefined();
    },
  );

  it.each<[QuoteStatusValue, boolean]>([
    ['draft', true],
    ['sent', true],
    ['expired', true],
    ['accepted', false],
    ['cancelled', false],
  ])('uses the same cancellation guard for a %s quote and its menu', (status, allowed) => {
    expect(canCancelQuote(status)).toBe(allowed);
  });
});
