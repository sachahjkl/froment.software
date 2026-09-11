import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  CurrentOrderConfirmationEvidence,
  OrderConfirmationEvidence,
} from './confirmation-evidence.js';

describe('order confirmation evidence', () => {
  it('requires the event calendar for every new confirmation', () => {
    const confirmation = { version: 2, orderCalendar: { timeZone: 'Europe/Paris' } };
    expect(Schema.decodeUnknownSync(CurrentOrderConfirmationEvidence)(confirmation)).toEqual(
      confirmation,
    );
    expect(Schema.is(OrderConfirmationEvidence)({ version: 2 })).toBe(false);
    expect(
      Schema.is(OrderConfirmationEvidence)({ version: 2, orderCalendar: { timeZone: 'unknown' } }),
    ).toBe(false);
    expect(Schema.is(OrderConfirmationEvidence)({ version: 3 })).toBe(false);
  });

  it('recognizes historical evidence explicitly without inventing an event calendar', () => {
    expect(
      Schema.decodeUnknownSync(OrderConfirmationEvidence)({
        version: 1,
        snapshot: { calendar: { timeZone: 'Europe/Paris' } },
      }),
    ).toEqual({ version: 1 });
  });
});
