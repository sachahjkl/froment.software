import { ConfigProvider, Effect, Layer } from 'effect';
import { HttpClient, HttpClientResponse, type HttpClientRequest } from 'effect/unstable/http';
import { expect, it } from 'vitest';
import { ConnectionConfigLive } from './connection-config.js';
import { CheckoutTransport } from './checkout-transport.js';
import { StripeCheckoutTransportLive } from './stripe.js';

const input = {
  requestId: '5189676e-7c04-4448-8f85-fa7ca68b9c15',
  revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  invoiceNumber: 'FA-2026-000001',
  amountCents: 12500,
  expiresAt: 1789045200000,
  returnUrl:
    'https://froment.example.test/backoffice/services/stripe/tests/5189676e-7c04-4448-8f85-fa7ca68b9c15',
};
const body = {
  id: 'cs_test_example',
  livemode: false,
  currency: 'eur',
  amount_total: 12500,
  client_reference_id: input.requestId,
  metadata: { requestId: input.requestId, revisionId: input.revisionId },
  status: 'open',
  payment_status: 'unpaid',
  url: 'https://checkout.stripe.com/c/pay/cs_test_example',
  expires_at: input.expiresAt / 1000,
};
const layer = (
  requests: HttpClientRequest.HttpClientRequest[],
  options: {
    readonly status?: number;
    readonly key?: string;
    readonly body?: string;
    readonly response?: () => Response;
  } = {},
) =>
  StripeCheckoutTransportLive.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) => {
          requests.push(request);
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              options.response?.() ??
                new Response(options.body ?? JSON.stringify(body), {
                  status: options.status ?? 200,
                }),
            ),
          );
        }),
      ),
    ),
    Layer.provide(ConnectionConfigLive),
    Layer.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          STRIPE_SECRET_KEY: options.key ?? 'sk_test_fake',
          PUBLIC_ORIGIN: 'https://froment.example.test',
        }),
      ),
    ),
  );

it('creates an idempotent test Checkout without products, client contact details or automatic tax', async () => {
  const requests: HttpClientRequest.HttpClientRequest[] = [];
  expect(
    await Effect.runPromise(
      CheckoutTransport.use((transport) => transport.create(input)).pipe(
        Effect.provide(layer(requests)),
      ),
    ),
  ).toEqual({
    id: body.id,
    mode: 'test',
    currency: 'EUR',
    amountCents: input.amountCents,
    requestId: input.requestId,
    revisionId: input.revisionId,
    status: 'open',
    url: body.url,
    expiresAt: input.expiresAt,
  });
  const request = requests[0];
  expect(request?.url).toBe('https://api.stripe.com/v1/checkout/sessions');
  expect(request?.headers['stripe-version']).toBe('2026-08-26.dahlia');
  expect(request?.headers['idempotency-key']).toBe(`froment-checkout-test/${input.requestId}`);
  expect(request?.headers['authorization']).toBe('Bearer sk_test_fake');
  if (request?.body._tag !== 'Uint8Array') throw new Error('Expected a form-encoded body');
  const values = new URLSearchParams(new TextDecoder().decode(request.body.body));
  expect(values.get('line_items[0][price_data][unit_amount]')).toBe('12500');
  expect(values.get('line_items[0][price_data][currency]')).toBe('eur');
  expect(values.get('customer_email')).toBe('sacha@sacha.house');
  expect(values.get('mode')).toBe('payment');
  expect(values.get('payment_method_types[0]')).toBe('card');
  expect(values.get('success_url')).toBe(input.returnUrl);
  expect(values.get('cancel_url')).toBe(input.returnUrl);
  expect(values.get('expires_at')).toBe(String(input.expiresAt / 1000));
  expect(values.has('automatic_tax[enabled]')).toBe(false);
});

it.each(['sk_live_fake', '', 'invalid'])(
  'refuses unsafe credentials %s before any network call',
  async (key) => {
    const requests: HttpClientRequest.HttpClientRequest[] = [];
    const result = await Effect.runPromise(
      CheckoutTransport.use((transport) => transport.create(input)).pipe(
        Effect.provide(layer(requests, { key })),
        Effect.flip,
      ),
    );
    expect(result).toMatchObject({
      code: key === '' ? 'checkout.credentialsMissing' : 'checkout.testKeyRequired',
      retryable: false,
    });
    expect(requests).toHaveLength(0);
  },
);

it('retries an interrupted response body with the same idempotency key and payload', async () => {
  const requests: HttpClientRequest.HttpClientRequest[] = [];
  await Effect.runPromise(
    Effect.gen(function* () {
      const transport = yield* CheckoutTransport;
      const failure = yield* transport.create(input).pipe(Effect.flip);
      expect(failure).toMatchObject({ code: 'checkout.unavailable', retryable: true });
      expect(yield* transport.create(input)).toMatchObject({ id: body.id });
    }).pipe(
      Effect.provide(
        layer(requests, {
          response: () =>
            requests.length === 1
              ? new Response(
                  new ReadableStream({
                    start(controller) {
                      controller.error(new Error('Response connection interrupted'));
                    },
                  }),
                  { status: 200 },
                )
              : new Response(JSON.stringify(body), { status: 200 }),
        }),
      ),
    ),
  );
  expect(requests).toHaveLength(2);
  expect(requests.map((request) => request.headers['idempotency-key'])).toEqual([
    `froment-checkout-test/${input.requestId}`,
    `froment-checkout-test/${input.requestId}`,
  ]);
  expect(requests[0]?.body).toEqual(requests[1]?.body);
});

it.each([400, 401, 409, 429, 500])(
  'classifies HTTP %s without retaining private provider diagnostics',
  async (status) => {
    const error = await Effect.runPromise(
      CheckoutTransport.use((transport) => transport.create(input)).pipe(
        Effect.provide(layer([], { status, body: '{"error":"private diagnostic"}' })),
        Effect.flip,
      ),
    );
    expect(error).toMatchObject({ retryable: status === 409 || status === 429 || status >= 500 });
    expect(JSON.stringify(error)).not.toContain('private diagnostic');
  },
);

it.each([
  { ...body, livemode: true },
  { ...body, id: 'cs_live_example' },
  { ...body, url: 'https://checkout.stripe.com.evil.example/pay' },
  { ...body, currency: 'usd' },
  { ...body, metadata: { ...body.metadata, requestId: 'another-request' } },
  {},
])('rejects invalid or live session responses', async (response) => {
  const error = await Effect.runPromise(
    CheckoutTransport.use((transport) => transport.create(input)).pipe(
      Effect.provide(layer([], { body: JSON.stringify(response) })),
      Effect.flip,
    ),
  );
  expect(error).toMatchObject({ code: 'checkout.responseMismatch', retryable: false });
});

it.each([
  ['complete', 'paid', 'paid'],
  ['complete', 'unpaid', 'open'],
  ['complete', 'no_payment_required', 'open'],
  ['open', 'paid', 'open'],
  ['expired', 'unpaid', 'expired'],
])('maps session %s and payment %s to %s', async (status, paymentStatus, expected) => {
  const session = await Effect.runPromise(
    CheckoutTransport.use((transport) => transport.retrieve(body.id)).pipe(
      Effect.provide(
        layer([], { body: JSON.stringify({ ...body, status, payment_status: paymentStatus }) }),
      ),
    ),
  );
  expect(session.status).toBe(expected);
  if (status !== 'open') expect(session.url).toBeNull();
});
