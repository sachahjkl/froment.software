import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { BootstrapFailure, BootstrapResult } from './contracts.js';

describe('bootstrap contracts', () => {
  it('validates the sign-in identifier', () => {
    expect(
      Schema.decodeUnknownSync(BootstrapResult)({
        accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    ).toEqual({
      accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    });
    expect(() =>
      Schema.decodeUnknownSync(BootstrapResult)({ accessIdentifier: 'invalid' }),
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
