import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { BootstrapFailure, BootstrapResult } from './contracts.js';

describe('bootstrap contracts', () => {
  it('validates the issued access token', () => {
    expect(
      Schema.decodeUnknownSync(BootstrapResult)({
        accessToken: 'v4.public.token',
        expiresAt: 600_000,
        mode: 'administrator',
      }),
    ).toEqual({
      accessToken: 'v4.public.token',
      expiresAt: 600_000,
      mode: 'administrator',
    });
    expect(() =>
      Schema.decodeUnknownSync(BootstrapResult)({
        accessToken: 'invalid',
        expiresAt: 600_000,
        mode: 'administrator',
      }),
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
