import { DocumentIncomplete, type DocumentPartyValue } from '@froment/contracts';
import { describe, expect, it } from 'vitest';
import { validateDocumentParties } from './validation.js';

const party: DocumentPartyValue = {
  displayName: 'Example company',
  addressLine1: '1 Example Road',
  addressLine2: '',
  postalCode: '',
  city: 'Hong Kong',
  country: 'Hong Kong',
  email: 'contact@example.test',
  phone: '',
};

describe('document contact validation', () => {
  it('accepts an address without a postal code', () => {
    expect(() => validateDocumentParties({ issuer: party, client: party })).not.toThrow();
  });

  it('accepts a client phone number without a client email address', () => {
    expect(() =>
      validateDocumentParties({
        issuer: party,
        client: { ...party, email: '', phone: '+852 2123 4567' },
      }),
    ).not.toThrow();
  });

  it('collects missing fields and invalid email addresses for both parties', () => {
    expect(() =>
      validateDocumentParties({
        issuer: { ...party, addressLine1: '  ', email: 'not-an-email' },
        client: { ...party, city: '', country: '\t', email: '' },
      }),
    ).toThrow(
      new DocumentIncomplete({
        code: 'document.incomplete',
        issues: [
          { party: 'issuer', field: 'addressLine1', reason: 'required' },
          { party: 'issuer', field: 'email', reason: 'invalid_email' },
          { party: 'client', field: 'city', reason: 'required' },
          { party: 'client', field: 'country', reason: 'required' },
          { party: 'client', field: 'email', reason: 'required' },
        ],
      }),
    );
  });
});
