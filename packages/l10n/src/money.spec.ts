import { describe, expect, it } from 'vitest';
import { formatMoney } from './money.js';

describe('localized money', () => {
  it('preserves every minor unit at the safe integer limits', () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER, 'fr-FR', 'EUR')).toBe('90 071 992 547 409,91 €');
    expect(formatMoney(Number.MIN_SAFE_INTEGER, 'en-US', 'EUR')).toBe('-€90,071,992,547,409.91');
  });
  it('uses locale grouping, decimal separators and currency placement', () => {
    expect(formatMoney(123456, 'fr-FR', 'EUR')).toBe('1 234,56 €');
    expect(formatMoney(123456, 'en-US', 'EUR')).toBe('€1,234.56');
    expect(formatMoney(-1, 'fr-FR', 'EUR')).toBe('-0,01 €');
    expect(formatMoney(0, 'en-US', 'EUR')).toBe('€0.00');
  });
  it('uses the currency precision, not a universal division by 100', () => {
    expect(formatMoney(1234, 'en-US', 'JPY')).toBe('¥1,234');
    expect(formatMoney(1234, 'en-US', 'KWD')).toBe('KWD 1.234');
  });
  it.each([NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid stored amounts',
    (amount) => {
      expect(() => formatMoney(amount, 'en-US', 'EUR')).toThrow(RangeError);
    },
  );
});
