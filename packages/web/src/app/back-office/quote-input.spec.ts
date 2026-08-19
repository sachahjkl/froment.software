import { describe, expect, it } from 'vitest';

import { formatFixedDecimal, parseFixedDecimal } from './quote-input';

describe('quote input conversion', () => {
  it('parses localized fixed decimals without floating-point arithmetic', () => {
    expect(parseFixedDecimal('1,500', 3)).toBe(1_500);
    expect(parseFixedDecimal('19.99', 2)).toBe(1_999);
    expect(parseFixedDecimal('20', 2)).toBe(2_000);
  });

  it('rejects ambiguous or excessive precision', () => {
    expect(parseFixedDecimal('1e3', 3)).toBeUndefined();
    expect(parseFixedDecimal('-1', 3)).toBeUndefined();
    expect(parseFixedDecimal('1.0001', 3)).toBeUndefined();
    expect(parseFixedDecimal('1,2.3', 3)).toBeUndefined();
  });

  it('formats stored units for editing', () => {
    expect(formatFixedDecimal(1_500, 3)).toBe('1.500');
    expect(formatFixedDecimal(1_999, 2)).toBe('19.99');
    expect(formatFixedDecimal(1_999, 2, ',')).toBe('19,99');
  });
});
