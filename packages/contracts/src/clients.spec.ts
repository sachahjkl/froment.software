import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { LoginRequest } from './authentication.js';
import { ClientCreateRequest } from './clients.js';

describe('client contracts', () => {
  it('accepts both account modes', () => {
    const accessIdentifier = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    expect(
      Schema.decodeUnknownSync(LoginRequest)({ accessIdentifier, mode: 'administrator' }).mode,
    ).toBe('administrator');
    expect(Schema.decodeUnknownSync(LoginRequest)({ accessIdentifier, mode: 'client' }).mode).toBe(
      'client',
    );
  });

  it('rejects blank client names', () => {
    expect(() => Schema.decodeUnknownSync(ClientCreateRequest)({ displayName: '   ' })).toThrow();
    expect(Schema.decodeUnknownSync(ClientCreateRequest)({ displayName: 'Acme' }).displayName).toBe(
      'Acme',
    );
  });
});
