import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { BootstrapFailure, BootstrapResult } from './bootstrap.js';

describe('bootstrap contracts', () => {
  it('validates administrator identifiers', () => {
    expect(
      Schema.decodeUnknownSync(BootstrapResult)({
        administratorId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toEqual({
      administratorId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(() =>
      Schema.decodeUnknownSync(BootstrapResult)({ administratorId: 'invalid' }),
    ).toThrow();
  });

  it('keeps bootstrap failure codes stable', () => {
    expect(
      Schema.decodeUnknownSync(BootstrapFailure)({
        _tag: 'BootstrapRejected',
        code: 'bootstrap.invalid_credentials',
      }).code,
    ).toBe('bootstrap.invalid_credentials');
  });
});
