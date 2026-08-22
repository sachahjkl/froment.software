import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { HealthStatus } from './contracts.js';

describe('HealthStatus', () => {
  it('accepts the available status', () => {
    expect(Schema.decodeUnknownSync(HealthStatus)({ status: 'ok' })).toEqual({ status: 'ok' });
  });

  it('rejects an unknown status', () => {
    expect(() => Schema.decodeUnknownSync(HealthStatus)({ status: 'down' })).toThrow();
  });
});
