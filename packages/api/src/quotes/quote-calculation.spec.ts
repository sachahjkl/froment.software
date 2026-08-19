import { describe, expect, it } from 'vitest';

import { calculateQuoteLine, calculateQuoteTotals } from './quote-calculation.js';

describe('quote calculation', () => {
  it('rounds half up for each line', () => {
    expect(
      calculateQuoteLine({
        description: 'Half cent',
        quantityMilli: 1,
        unitPriceCents: 500,
        vatRateBasisPoints: 5_000,
      }),
    ).toEqual({ netTotalCents: 1, vatTotalCents: 1, totalCents: 2 });
    expect(
      calculateQuoteLine({
        description: 'Below half',
        quantityMilli: 1,
        unitPriceCents: 499,
        vatRateBasisPoints: 10_000,
      }),
    ).toEqual({ netTotalCents: 0, vatTotalCents: 0, totalCents: 0 });
  });

  it('keeps safe integer boundaries exact', () => {
    expect(
      calculateQuoteLine({
        description: 'Maximum',
        quantityMilli: 1_000,
        unitPriceCents: Number.MAX_SAFE_INTEGER,
        vatRateBasisPoints: 0,
      }).totalCents,
    ).toBe(Number.MAX_SAFE_INTEGER);
    expect(() =>
      calculateQuoteLine({
        description: 'Overflow',
        quantityMilli: 1_001,
        unitPriceCents: Number.MAX_SAFE_INTEGER,
        vatRateBasisPoints: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateQuoteTotals([
        {
          netTotalCents: Number.MAX_SAFE_INTEGER,
          vatTotalCents: 0,
          totalCents: Number.MAX_SAFE_INTEGER,
        },
        { netTotalCents: 1, vatTotalCents: 0, totalCents: 1 },
      ]),
    ).toThrow(RangeError);
  });
});
