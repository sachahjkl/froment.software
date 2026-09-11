import { Schema } from 'effect';
import { expect, it } from 'vitest';
import { IssuerSettingsUpdateRequest } from './contracts.js';

it('requires a positive integer version for issuer updates', () => {
  const settings = {
    displayName: 'Test',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: '',
    email: '',
    phone: '',
    registrationNumber: '',
    vatNumber: '',
  };
  expect(Schema.is(IssuerSettingsUpdateRequest)(settings)).toBe(false);
  for (const expectedVersion of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(Schema.is(IssuerSettingsUpdateRequest)({ ...settings, expectedVersion })).toBe(false);
  }
  expect(Schema.is(IssuerSettingsUpdateRequest)({ ...settings, expectedVersion: 1 })).toBe(true);
});
