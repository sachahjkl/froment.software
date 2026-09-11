import { ConfigProvider, Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import { AuthenticationConfig, AuthenticationConfigLive } from './authentication-config.js';

const validSecretKey =
  'k4.secret.NXrAOzhnhDuDrGPrMHzfIwwJi88ZgKI4L4x6DaXjp2ycuz4ubSc_ZLzoQlOEnp-gDMpdjFgTwp0mHG8LP2QuFA';

const load = (pasetoSecretKey: string) =>
  AuthenticationConfig.pipe(
    Effect.provide(AuthenticationConfigLive),
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          API_TOKEN_HMAC_KEY: 'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
          BOOTSTRAP_PASSWORD_SCRYPT:
            'scrypt$16384$8$1$ABEiM0RVZneImaq7zN3u_w$bDQwYDYiQ_8HCiJ3-qXFtXFeV9FhIOa7E8VSgT__uegLrk4vqD6U920ImYTwk5RABOZsIk96bUNH1G9wbCXf1Q',
          PASETO_SECRET_KEY: pasetoSecretKey,
          PUBLIC_ORIGIN: 'https://example.test',
          QUOTE_LINK_HMAC_KEY: 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
          REFRESH_HMAC_KEY: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        }),
      ),
    ),
  );

describe('AuthenticationConfig', () => {
  it('accepts a valid PASETO signing key pair', async () => {
    const config = await Effect.runPromise(load(validSecretKey));
    expect(config.pasetoPublicKey).toBe('k4.public.nLs-Lm0nP2S86EJThJ6foAzKXYxYE8KdJhxvCz9kLhQ');
  });

  it('rejects random bytes without a matching Ed25519 public key', async () => {
    const randomBytes = `k4.secret.${'A'.repeat(86)}`;
    const error = await Effect.runPromise(load(randomBytes).pipe(Effect.flip));
    expect(error._tag).toBe('SchemaError');
  });
});
