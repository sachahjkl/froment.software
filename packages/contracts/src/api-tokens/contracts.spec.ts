import { describe, expect, it } from 'vitest';
import { Schema } from 'effect';

import { ApiTokenCreateRequest, ApiTokenCreated } from './contracts.js';

describe('API token contracts', () => {
  it('accepts a bounded token request', () => {
    expect(
      Schema.decodeUnknownSync(ApiTokenCreateRequest)({
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
      Schema.decodeUnknownSync(ApiTokenCreateRequest)({
        name: 'ERP principal',
        permissions: [],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ApiTokenCreateRequest)({
        name: 'ERP principal',
        permissions: ['client.read', 'client.read'],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(ApiTokenCreateRequest)({
        name: 'ERP principal',
        permissions: ['unknown.manage'],
        expiresAt: 1_800_000_000_000,
      }),
    ).toThrow();
  });

  it('accepts a created token with its one-time secret', () => {
    expect(
      Schema.decodeUnknownSync(ApiTokenCreated)({
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
        secret: `froment_api_v1_01ARZ3NDEKTSV4RRFFQ69G5FAV.${'a'.repeat(43)}`,
      }).secret,
    ).toHaveLength(85);
  });
});
