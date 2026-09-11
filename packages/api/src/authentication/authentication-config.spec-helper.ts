import { AuthenticationConfig } from './authentication-config.js';

export const authenticationConfig = AuthenticationConfig.of({
  publicOrigin: 'https://example.test',
  bootstrapPasswordHash: {
    cost: 16_384,
    blockSize: 8,
    parallelization: 1,
    salt: Buffer.alloc(16),
    hash: Buffer.alloc(64),
  },
  pasetoSecretKey: 'unused',
  pasetoPublicKey: 'unused',
  apiTokenHmacKey: Buffer.alloc(32, 1),
  refreshHmacKey: Buffer.alloc(32, 2),
  quoteLinkHmacKey: Buffer.alloc(32, 3),
});
