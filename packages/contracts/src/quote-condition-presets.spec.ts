import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  QuoteConditionPreset,
  QuoteConditionPresetWriteRequest,
} from './quote-condition-presets.js';

describe('quote condition preset contracts', () => {
  it('validates named reusable conditions', () => {
    const preset = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'Payment in 30 days',
      conditions: 'Payment is due within 30 days.',
    };

    expect(Schema.decodeUnknownSync(QuoteConditionPreset)(preset)).toEqual(preset);
    expect(Schema.decodeUnknownSync(QuoteConditionPresetWriteRequest)(preset)).toEqual({
      name: preset.name,
      conditions: preset.conditions,
    });
    expect(() =>
      Schema.decodeUnknownSync(QuoteConditionPresetWriteRequest)({ ...preset, name: ' ' }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(QuoteConditionPresetWriteRequest)({ ...preset, conditions: '' }),
    ).toThrow();
  });
});
