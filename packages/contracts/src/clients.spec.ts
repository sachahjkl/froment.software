import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { LoginRequest } from './authentication.js';
import { ClientCreateRequest, ClientSummary, ClientUpdateRequest } from './clients.js';

describe('client contracts', () => {
  const client = {
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: '',
    email: '',
  };
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
    expect(() =>
      Schema.decodeUnknownSync(ClientCreateRequest)({ ...client, displayName: '   ' }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(ClientCreateRequest)({ ...client, displayName: 'Acme' }).displayName,
    ).toBe('Acme');
    expect(() => Schema.decodeUnknownSync(ClientSummary.fields.displayName)('   ')).toThrow();
  });

  it('requires an explicit update version', () => {
    expect(() =>
      Schema.decodeUnknownSync(ClientUpdateRequest)({ ...client, displayName: 'Acme' }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(ClientUpdateRequest)({
        ...client,
        displayName: 'Acme',
        expectedUpdatedAt: 42,
      }).expectedUpdatedAt,
    ).toBe(42);
  });
});
