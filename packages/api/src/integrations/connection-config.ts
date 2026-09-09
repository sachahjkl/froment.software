import { Config, Context, Effect, Layer, Option, Redacted } from 'effect';
import type { ProviderConnections } from '@froment/contracts';

const makeConnectionConfig = Effect.gen(function* () {
  const resend = yield* Config.option(Config.redacted('RESEND_API_KEY'));
  const stripe = yield* Config.option(Config.redacted('STRIPE_SECRET_KEY'));
  const stripeWebhook = yield* Config.option(Config.redacted('STRIPE_WEBHOOK_SECRET'));
  const signwell = yield* Config.option(Config.redacted('SIGNWELL_API_KEY'));
  const superpdpId = yield* Config.option(Config.redacted('SUPERPDP_CLIENT_ID'));
  const superpdpSecret = yield* Config.option(Config.redacted('SUPERPDP_CLIENT_SECRET'));
  const present = (value: Option.Option<Redacted.Redacted<string>>) =>
    Option.isSome(value) && Redacted.value(value.value).trim().length > 0;
  const connections: typeof ProviderConnections.Type = [
    {
      provider: 'resend',
      credentialsPresent: present(resend),
      missingSecrets: present(resend) ? [] : ['RESEND_API_KEY'],
      mode: 'restricted-test',
    },
    {
      provider: 'stripe',
      credentialsPresent: present(stripe),
      missingSecrets: present(stripe) ? [] : ['STRIPE_SECRET_KEY'],
      mode: 'restricted-test',
    },
    {
      provider: 'signwell',
      credentialsPresent: present(signwell),
      missingSecrets: present(signwell) ? [] : ['SIGNWELL_API_KEY'],
      mode: 'not-connected',
    },
    {
      provider: 'superpdp',
      credentialsPresent: present(superpdpId) && present(superpdpSecret),
      missingSecrets: [
        ...(present(superpdpId) ? [] : ['SUPERPDP_CLIENT_ID']),
        ...(present(superpdpSecret) ? [] : ['SUPERPDP_CLIENT_SECRET']),
      ],
      mode: 'not-connected',
    },
  ];
  return {
    resend: present(resend) ? resend : Option.none(),
    stripe: present(stripe) ? stripe : Option.none(),
    stripeWebhook: present(stripeWebhook) ? stripeWebhook : Option.none(),
    connections,
  };
});
export class ConnectionConfig extends Context.Service<
  ConnectionConfig,
  Effect.Success<typeof makeConnectionConfig>
>()('@froment/api/ConnectionConfig') {}
export const ConnectionConfigLive = Layer.effect(ConnectionConfig, makeConnectionConfig);
