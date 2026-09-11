import { Config, Effect, Layer, Option, Redacted, Schema } from 'effect';
import { CheckoutSessionId, CheckoutUrl } from '@froment/contracts';
import { HttpClient, HttpClientRequest } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';
import { createHash } from 'node:crypto';
import {
  CheckoutTransport,
  CheckoutTransportError,
  type CheckoutSession,
  type CheckoutSubmission,
} from './checkout-transport.js';
import { ConnectionConfig } from './connection-config.js';

const StripeSession = Schema.Struct({
  id: CheckoutSessionId,
  livemode: Schema.Literal(false),
  currency: Schema.Literal('eur'),
  amount_total: Schema.Int,
  client_reference_id: Schema.String,
  metadata: Schema.Struct({ requestId: Schema.String, revisionId: Schema.String }),
  status: Schema.Literals(['open', 'complete', 'expired']),
  payment_status: Schema.Literals(['paid', 'unpaid', 'no_payment_required']),
  url: Schema.NullOr(CheckoutUrl),
  expires_at: Schema.Int,
}).check(
  Schema.makeFilter((session) => session.client_reference_id === session.metadata.requestId),
);

export const StripeCheckoutTransportLive = Layer.effect(
  CheckoutTransport,
  Effect.gen(function* () {
    const config = yield* ConnectionConfig;
    const publicUrl = yield* Config.schema(Schema.URL, 'PUBLIC_ORIGIN');
    const testKey =
      Option.isSome(config.stripe) && /^(sk|rk)_test_/.test(Redacted.value(config.stripe.value));
    const connection = {
      credentialsPresent: Option.isSome(config.stripe),
      testKey,
      webhookConfigured: Option.isSome(config.stripeWebhook),
    };
    const accountKey =
      testKey && Option.isSome(config.stripe)
        ? createHash('sha256').update(Redacted.value(config.stripe.value)).digest('hex')
        : null;
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.withScope,
      HttpClient.withRateLimiter({
        limiter: yield* RateLimiter.RateLimiter,
        window: '1 second',
        limit: 10,
        key: 'stripe-test',
        times: 0,
      }),
    );
    const execute = Effect.fn('Stripe.execute')(
      function* (request: HttpClientRequest.HttpClientRequest) {
        if (Option.isNone(config.stripe))
          return yield* new CheckoutTransportError({
            code: 'checkout.credentialsMissing',
            retryable: false,
          });
        if (!testKey)
          return yield* new CheckoutTransportError({
            code: 'checkout.testKeyRequired',
            retryable: false,
          });
        const response = yield* client
          .execute(
            request.pipe(
              HttpClientRequest.prependUrl('https://api.stripe.com'),
              HttpClientRequest.bearerToken(config.stripe.value),
              HttpClientRequest.setHeader('Stripe-Version', '2026-08-26.dahlia'),
              HttpClientRequest.acceptJson,
            ),
          )
          .pipe(
            Effect.mapError(
              () => new CheckoutTransportError({ code: 'checkout.unavailable', retryable: true }),
            ),
          );
        if (response.status === 429)
          return yield* new CheckoutTransportError({
            code: 'checkout.rateLimited',
            retryable: true,
          });
        if (response.status >= 500 || response.status === 408 || response.status === 409)
          return yield* new CheckoutTransportError({
            code: 'checkout.unavailable',
            retryable: true,
          });
        if (response.status < 200 || response.status >= 300)
          return yield* new CheckoutTransportError({ code: 'checkout.rejected', retryable: false });
        const body = yield* response.text.pipe(
          Effect.mapError(
            () => new CheckoutTransportError({ code: 'checkout.unavailable', retryable: true }),
          ),
        );
        const session = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(StripeSession))(
          body,
        ).pipe(
          Effect.mapError(
            () =>
              new CheckoutTransportError({ code: 'checkout.responseMismatch', retryable: false }),
          ),
        );
        return {
          id: session.id,
          mode: 'test',
          currency: 'EUR',
          amountCents: session.amount_total,
          requestId: session.client_reference_id,
          revisionId: session.metadata.revisionId,
          status:
            session.status === 'expired'
              ? 'expired'
              : session.status === 'complete' && session.payment_status === 'paid'
                ? 'paid'
                : 'open',
          url: session.status === 'open' ? session.url : null,
          expiresAt: session.expires_at * 1000,
        } satisfies CheckoutSession;
      },
      Effect.scoped,
      Effect.timeout('20 seconds'),
      Effect.catchTag('TimeoutError', () =>
        Effect.fail(new CheckoutTransportError({ code: 'checkout.unavailable', retryable: true })),
      ),
    );
    const create = Effect.fn('Stripe.createCheckout')(function* (input: CheckoutSubmission) {
      return yield* execute(
        HttpClientRequest.post('/v1/checkout/sessions').pipe(
          HttpClientRequest.setHeader(
            'Idempotency-Key',
            `froment-checkout-test/${input.requestId}`,
          ),
          HttpClientRequest.bodyUrlParams({
            mode: 'payment',
            'payment_method_types[0]': 'card',
            'line_items[0][price_data][currency]': 'eur',
            'line_items[0][price_data][unit_amount]': String(input.amountCents),
            'line_items[0][price_data][product_data][name]': `[TEST] ${input.invoiceNumber}`,
            'line_items[0][quantity]': '1',
            client_reference_id: input.requestId,
            'metadata[requestId]': input.requestId,
            'metadata[revisionId]': input.revisionId,
            customer_email: 'sacha@sacha.house',
            expires_at: String(input.expiresAt / 1000),
            success_url: input.returnUrl,
            cancel_url: input.returnUrl,
          }),
        ),
      );
    });
    const retrieve = Effect.fn('Stripe.retrieveCheckout')(function* (sessionId: string) {
      return yield* execute(
        HttpClientRequest.get(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`),
      );
    });
    return CheckoutTransport.of({
      connection,
      accountKey,
      publicOrigin: publicUrl.origin,
      create,
      retrieve,
    });
  }),
).pipe(Layer.provide(RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory))));
