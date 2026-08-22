import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { LoginRequest } from '../authentication/contracts.js';
import { ClientCreateRequest, ClientSummary, ClientUpdateRequest } from './contracts.js';

describe('client contracts', () => {
  const client = {
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: '',
    email: '',
  };
  it('accepts email and password without an account mode', () => {
    expect(
      Schema.decodeUnknownSync(LoginRequest)({
        email: 'client@example.test',
        password: 'correct horse battery staple',
      }),
    ).toEqual({
      email: 'client@example.test',
      password: 'correct horse battery staple',
    });
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
