import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';

import { IntegrationTokenCreateRequest, IntegrationTokenCreated } from './integration-tokens.js';

describe('integration token contracts', () => {
  it('accepts a bounded token request', () => {
    expect(
      Schema.decodeUnknownSync(IntegrationTokenCreateRequest)({
        name: 'ERP principal',
        permissions: ['client.read', 'invoice.read'],
        expiresAt: 1_800_000_000_000,
      }),
    ).toEqual({
      name: 'ERP principal',
      permissions: ['client.read', 'invoice.read'],
      expiresAt: 1_800_000_000_000,
    });
  });

  it('rejects empty, duplicate, and administrative permissions', () => {
    expect(() =>
      Schema.decodeUnknownSync(IntegrationTokenCreateRequest)({
        name: 'ERP principal',
        permissions: [],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(IntegrationTokenCreateRequest)({
        name: 'ERP principal',
        permissions: ['client.read', 'client.read'],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(IntegrationTokenCreateRequest)({
        name: 'ERP principal',
        permissions: ['integration.manage'],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
  });

  it('accepts a created token with its one-time secret', () => {
    expect(
      Schema.decodeUnknownSync(IntegrationTokenCreated)({
        token: {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          name: 'ERP principal',
          permissions: ['client.read'],
          createdAt: 1_700_000_000_000,
          expiresAt: 1_800_000_000_000,
          lastUsedAt: null,
          revokedAt: null,
          rateLimitPerMinute: 120,
        },
        secret: `froment_it_v1_01ARZ3NDEKTSV4RRFFQ69G5FAV.${'a'.repeat(43)}`,
      }).secret,
    ).toHaveLength(84);
  });
});
