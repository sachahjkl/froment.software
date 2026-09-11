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
    const request = { ...client, requestId: '4d2d762e-a1c5-4e02-a6af-7a8c473d4b33' };
    expect(() =>
      Schema.decodeUnknownSync(ClientCreateRequest)({ ...request, displayName: '   ' }),
    ).toThrow();
    expect(
      Schema.decodeUnknownSync(ClientCreateRequest)({ ...request, displayName: 'Acme' })
        .displayName,
    ).toBe('Acme');
    expect(() => Schema.decodeUnknownSync(ClientSummary.fields.displayName)('   ')).toThrow();
  });

  it('requires a UUID creation identity without adding it to updates', () => {
    for (const requestId of [undefined, '', 'invalid', '01ARZ3NDEKTSV4RRFFQ69G5FAV']) {
      expect(Schema.is(ClientCreateRequest)({ ...client, displayName: 'Acme', requestId })).toBe(
        false,
      );
    }
    expect(
      Schema.is(ClientCreateRequest)({
        ...client,
        displayName: 'Acme',
        requestId: '4d2d762e-a1c5-4e02-a6af-7a8c473d4b33',
      }),
    ).toBe(true);
    expect(ClientUpdateRequest.fields).not.toHaveProperty('requestId');
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
