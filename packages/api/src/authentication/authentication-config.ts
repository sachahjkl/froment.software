import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';
import { createHmac } from 'node:crypto';

const ScryptHash = Schema.String.check(
  Schema.isPattern(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/),
);
const HmacKey = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));

export interface BootstrapPasswordHash {
  readonly cost: 16_384;
  readonly blockSize: 8;
  readonly parallelization: 1;
  readonly salt: Buffer;
  readonly hash: Buffer;
}

export interface AuthenticationConfigService {
  readonly bootstrapPasswordHash: BootstrapPasswordHash;
  readonly accessHmacKey: Buffer;
  readonly sessionHmacKey: Buffer;
  readonly quoteLinkHmacKey: Buffer;
  readonly publicOrigin: string;
}

export class AuthenticationConfig extends Context.Service<
  AuthenticationConfig,
  AuthenticationConfigService
>()('@froment/api/AuthenticationConfig') {}

export const AuthenticationConfigLive = Layer.effect(
  AuthenticationConfig,
  Effect.gen(function* () {
    const encodedBootstrapPasswordHash = yield* Schema.decodeUnknownEffect(ScryptHash)(
      Redacted.value(yield* Config.redacted('BOOTSTRAP_PASSWORD_SCRYPT')),
    );
    const accessHmacKey = yield* Schema.decodeUnknownEffect(HmacKey)(
      Redacted.value(yield* Config.redacted('ACCESS_HMAC_KEY')),
    );
    const sessionHmacKey = yield* Schema.decodeUnknownEffect(HmacKey)(
      Redacted.value(yield* Config.redacted('SESSION_HMAC_KEY')),
    );
    const quoteLinkHmacKey = yield* Schema.decodeUnknownEffect(HmacKey)(
      Redacted.value(yield* Config.redacted('QUOTE_LINK_HMAC_KEY')),
    );
    const publicUrl = yield* Config.schema(Schema.URL, 'PUBLIC_ORIGIN');

    const [, , , , salt, hash] = encodedBootstrapPasswordHash.split('$');
    return AuthenticationConfig.of({
      bootstrapPasswordHash: {
        cost: 16_384,
        blockSize: 8,
        parallelization: 1,
        salt: Buffer.from(salt, 'base64url'),
        hash: Buffer.from(hash, 'base64url'),
      },
      accessHmacKey: Buffer.from(accessHmacKey, 'base64url'),
      sessionHmacKey: Buffer.from(sessionHmacKey, 'base64url'),
      quoteLinkHmacKey: Buffer.from(quoteLinkHmacKey, 'base64url'),
      publicOrigin: publicUrl.origin,
    });
  }),
);

export const hmac = (key: Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest();
