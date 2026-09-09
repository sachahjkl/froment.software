import { CheckoutSessionId } from '@froment/contracts';
import { Clock, Effect, Option, Redacted, Schema } from 'effect';
import { HttpRouter, HttpServerRequest, HttpServerResponse } from 'effect/unstable/http';
import Stripe from 'stripe';
import { RequestLimiter } from '../server/request-limiter.js';
import { ConnectionConfig } from './connection-config.js';
import { Checkouts } from './checkout-service.js';

class StripeWebhookError extends Schema.TaggedError<StripeWebhookError>()('StripeWebhookError', {
  status: Schema.Literals([400, 503]),
}) {}
const Event = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^evt_[A-Za-z0-9]+$/)),
  livemode: Schema.Literal(false),
  type: Schema.String,
  data: Schema.Struct({ object: Schema.Struct({ id: Schema.String }) }),
});
const eventTypes = [
  'checkout.session.completed',
  'checkout.session.expired',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
];
export const verifyStripeEvent = Effect.fn('Stripe.verifyWebhook')(function* (
  body: string,
  signature: string,
) {
  const config = yield* ConnectionConfig;
  if (Option.isNone(config.stripeWebhook)) return yield* new StripeWebhookError({ status: 503 });
  const secret = Redacted.value(config.stripeWebhook.value);
  const now = yield* Clock.currentTimeMillis;
  const event = yield* Effect.try({
    try: () =>
      Schema.decodeUnknownSync(Event)(
        Stripe.webhooks.constructEvent(body, signature, secret, 300, undefined, now),
      ),
    catch: () => new StripeWebhookError({ status: 400 }),
  });
  if (!eventTypes.includes(event.type)) return undefined;
  const sessionId = yield* Schema.decodeUnknownEffect(CheckoutSessionId)(event.data.object.id).pipe(
    Effect.mapError(() => new StripeWebhookError({ status: 400 })),
  );
  return { id: event.id, type: event.type, sessionId };
});

export const StripeWebhookRoute = HttpRouter.add(
  'POST',
  '/api/integrations/stripe/webhook',
  Effect.gen(function* () {
    const limiter = yield* RequestLimiter;
    if (!(yield* limiter.allowRequest('stripe.webhook', 120)))
      return HttpServerResponse.empty({ status: 429 });
    const request = yield* HttpServerRequest.HttpServerRequest;
    const body = yield* request.text;
    const event = yield* verifyStripeEvent(body, request.headers['stripe-signature'] ?? '');
    if (event !== undefined) yield* (yield* Checkouts).receiveEvent(event);
    return HttpServerResponse.empty({ status: 200, headers: { 'cache-control': 'no-store' } });
  }).pipe(
    Effect.catchTag('StripeWebhookError', (error) =>
      Effect.succeed(HttpServerResponse.empty({ status: error.status })),
    ),
    Effect.catchTag('DatabaseError', () =>
      Effect.succeed(HttpServerResponse.empty({ status: 503 })),
    ),
  ),
);
