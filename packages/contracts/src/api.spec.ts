import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { RevisionVersionParameter } from './api.js';

describe('API contracts', () => {
  it('accepts only positive safe route versions', () => {
    expect(Schema.decodeUnknownSync(RevisionVersionParameter)('1')).toBe(1);
    expect(
      Schema.decodeUnknownSync(RevisionVersionParameter)(String(Number.MAX_SAFE_INTEGER)),
    ).toBe(Number.MAX_SAFE_INTEGER);

    for (const version of ['0', '-1', '1.5', '9007199254740992', '9007199254740993']) {
      expect(() => Schema.decodeUnknownSync(RevisionVersionParameter)(version)).toThrow();
    }
  });
});
