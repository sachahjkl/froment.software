import { describe, expect, it } from 'vitest';

import { resolveClientAddress } from './request.js';

describe('resolveClientAddress', () => {
  it('accepts X-Real-IP only from an explicitly trusted proxy', () => {
    const trustedProxies = new Set(['10.0.0.2']);

    expect(resolveClientAddress('10.0.0.2', '192.0.2.1', trustedProxies)).toBe('192.0.2.1');
    expect(resolveClientAddress('10.0.0.3', '192.0.2.2', trustedProxies)).toBe('10.0.0.3');
    expect(resolveClientAddress('10.0.0.2', 'not-an-address', trustedProxies)).toBe('10.0.0.2');
  });
});
