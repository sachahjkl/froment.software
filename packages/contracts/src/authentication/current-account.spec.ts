import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { CurrentAccount } from './contracts.js';

const account = {
  userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  email: 'accountant@example.test',
  mode: 'administrator',
};

describe('CurrentAccount', () => {
  it('requires explicit effective permissions without deriving them from the mode', () => {
    expect(Schema.is(CurrentAccount)(account)).toBe(false);
    expect(
      Schema.decodeUnknownSync(CurrentAccount)({ ...account, permissions: [] }).permissions,
    ).toEqual([]);
    expect(
      Schema.decodeUnknownSync(CurrentAccount)({ ...account, permissions: ['client.read'] })
        .permissions,
    ).toEqual(['client.read']);
  });

  it('rejects unknown and duplicate permission codes', () => {
    expect(Schema.is(CurrentAccount)({ ...account, permissions: ['client.write'] })).toBe(false);
    expect(
      Schema.is(CurrentAccount)({ ...account, permissions: ['client.read', 'client.read'] }),
    ).toBe(false);
  });
});
