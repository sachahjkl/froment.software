import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { verifyBootstrapPassword } from './bootstrap.js';

describe('verifyBootstrapPassword', () => {
  it('verifies the configured scrypt hash and rejects another password', async () => {
    const expected = {
      cost: 16_384 as const,
      blockSize: 8 as const,
      parallelization: 1 as const,
      salt: Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
      hash: Buffer.from(
        'bDQwYDYiQ_8HCiJ3-qXFtXFeV9FhIOa7E8VSgT__uegLrk4vqD6U920ImYTwk5RABOZsIk96bUNH1G9wbCXf1Q',
        'base64url',
      ),
    };

    await expect(
      Effect.runPromise(verifyBootstrapPassword('bootstrap-password', expected)),
    ).resolves.toBe(true);
    await expect(Effect.runPromise(verifyBootstrapPassword('wrong', expected))).resolves.toBe(
      false,
    );
  });
});
