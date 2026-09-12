import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { SupplierCreateRequest, SupplierInput } from './contracts.js';

const input = {
  displayName: 'Fournitures Exemple',
  addressLine1: '1 rue du Test',
  addressLine2: '',
  postalCode: '75001',
  city: 'Paris',
  country: 'France',
  email: 'billing@example.test',
  phone: '+33 1 23 45 67 89',
  registrationNumber: '123456789',
  vatNumber: 'FR00123456789',
  taxTreatment: 'france',
  defaultCurrency: 'EUR',
  paymentTermsDays: 30,
  iban: 'FR7630006000011234567890189',
  bic: 'AGRIFRPP',
};

describe('supplier contracts', () => {
  it('accepts complete supplier details', () => {
    expect(Schema.decodeUnknownSync(SupplierInput)(input)).toEqual(input);
  });

  it('rejects invalid payment and bank details', () => {
    expect(Schema.is(SupplierInput)({ ...input, defaultCurrency: 'euro' })).toBe(false);
    expect(Schema.is(SupplierInput)({ ...input, paymentTermsDays: 366 })).toBe(false);
    expect(Schema.is(SupplierInput)({ ...input, iban: 'invalid' })).toBe(false);
    expect(Schema.is(SupplierInput)({ ...input, bic: 'invalid' })).toBe(false);
  });

  it('requires an idempotency key for creation', () => {
    expect(
      Schema.is(SupplierCreateRequest)({
        ...input,
        requestId: '4d2d762e-a1c5-4e02-a6af-7a8c473d4b33',
      }),
    ).toBe(true);
    expect(Schema.is(SupplierCreateRequest)({ ...input, requestId: 'invalid' })).toBe(false);
  });
});
