import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';
import { createHmac } from 'node:crypto';

const Sha512Hash = Schema.String.check(Schema.isPattern(/^[0-9a-fA-F]{128}$/));
const HmacKey = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));

export interface AuthenticationConfigService {
  readonly bootstrapPasswordHash: Buffer;
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
    const bootstrapPasswordHash = yield* Schema.decodeUnknownEffect(Sha512Hash)(
      Redacted.value(yield* Config.redacted('BOOTSTRAP_PASSWORD_SHA512')),
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

    return AuthenticationConfig.of({
      bootstrapPasswordHash: Buffer.from(bootstrapPasswordHash, 'hex'),
      accessHmacKey: Buffer.from(accessHmacKey, 'base64url'),
      sessionHmacKey: Buffer.from(sessionHmacKey, 'base64url'),
      quoteLinkHmacKey: Buffer.from(quoteLinkHmacKey, 'base64url'),
      publicOrigin: publicUrl.origin,
    });
  }),
);

export const hmac = (key: Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest();
