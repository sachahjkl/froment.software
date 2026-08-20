import { DateTime } from 'effect';
import { describe, expect, it } from 'vitest';

import { invoiceIssueDate } from '../src/invoices/invoices.js';

const paris = DateTime.zoneMakeNamedUnsafe('Europe/Paris');

describe('invoice issue date', () => {
  it.each([
    ['2026-08-20T21:59:59.999Z', '2026-08-20'],
    ['2026-08-20T22:00:00.000Z', '2026-08-21'],
    ['2026-01-20T22:59:59.999Z', '2026-01-20'],
    ['2026-01-20T23:00:00.000Z', '2026-01-21'],
  ])('uses the Paris calendar day for %s', (instant, expected) => {
    expect(invoiceIssueDate(DateTime.toEpochMillis(DateTime.makeUnsafe(instant)), paris)).toBe(
      expected,
    );
  });

  it.each([
    ['2026-03-29T00:59:59.999Z', '2026-03-29'],
    ['2026-03-29T01:00:00.000Z', '2026-03-29'],
    ['2026-10-25T00:59:59.999Z', '2026-10-25'],
    ['2026-10-25T01:00:00.000Z', '2026-10-25'],
  ])('keeps the business date across the daylight-saving change at %s', (instant, expected) => {
    expect(invoiceIssueDate(DateTime.toEpochMillis(DateTime.makeUnsafe(instant)), paris)).toBe(
      expected,
    );
  });
});
