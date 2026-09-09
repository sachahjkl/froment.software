import { ConfigProvider, Effect, Layer } from 'effect';
import { TestClock } from 'effect/testing';
import Stripe from 'stripe';
import { expect, it } from 'vitest';
import { ConnectionConfigLive } from './connection-config.js';
import { verifyStripeEvent } from './stripe-webhook.js';

const now = 1788973200000;
const secret = 'whsec_test_only';
const body = JSON.stringify({
  id: 'evt_example',
  livemode: false,
  type: 'checkout.session.completed',
  data: { object: { id: 'cs_test_example' } },
});
const signature = (payload = body, timestamp = now / 1000) =>
  Stripe.webhooks.generateTestHeaderString({ payload, timestamp, secret });
const verify = (payload: string, header: string, configured = true) =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      return yield* verifyStripeEvent(payload, header);
    }).pipe(
      Effect.provide(
        ConnectionConfigLive.pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown(configured ? { STRIPE_WEBHOOK_SECRET: secret } : {}),
            ),
          ),
        ),
      ),
      Effect.provide(TestClock.layer()),
      Effect.result,
    ),
  );

it('verifies the raw body with the official SDK and rejects changed bytes, stale signatures, live events and absent secrets', async () => {
  expect(await verify(body, signature())).toMatchObject({
    _tag: 'Success',
    success: { id: 'evt_example', sessionId: 'cs_test_example' },
  });
  expect(await verify(`${body} `, signature())).toMatchObject({
    _tag: 'Failure',
    failure: { status: 400 },
  });
  expect(await verify(body, signature(body, now / 1000 - 301))).toMatchObject({
    _tag: 'Failure',
    failure: { status: 400 },
  });
  expect(await verify(body, '')).toMatchObject({ _tag: 'Failure', failure: { status: 400 } });
  expect(await verify(body, signature(), false)).toMatchObject({
    _tag: 'Failure',
    failure: { status: 503 },
  });
  const live = body.replace('"livemode":false', '"livemode":true');
  expect(await verify(live, signature(live))).toMatchObject({
    _tag: 'Failure',
    failure: { status: 400 },
  });
});
