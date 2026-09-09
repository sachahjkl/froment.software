import { ConfigProvider, Effect, Layer } from 'effect';
import { HttpClient, HttpClientResponse, type HttpClientRequest } from 'effect/unstable/http';
import { expect, it } from 'vitest';
import { ConnectionConfigLive } from './connection-config.js';
import { EmailTransport } from './email-transport.js';
import { ResendEmailTransportLive } from './resend.js';

const input = {
  requestId: '65b77a72-e172-42f3-94bb-e0c72e733c91',
  from: 'Test <sender@example.test>',
  replyTo: 'reply@example.test',
  recipient: 'recipient@example.test',
  subject: '[Test] Subject',
  body: 'Hello\nWorld',
};
const providerId = '13d1635c-64c8-4078-b0f5-d936fb3791dd';
const layer = (
  status: number,
  body: Readonly<Record<string, string>>,
  requests: HttpClientRequest.HttpClientRequest[],
  credentials = true,
  signals: AbortSignal[] = [],
) =>
  ResendEmailTransportLive.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request, _url, signal) => {
          requests.push(request);
          signals.push(signal);
          return Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response(JSON.stringify(body), {
                status,
                headers: { 'content-type': 'application/json' },
              }),
            ),
          );
        }),
      ),
    ),
    Layer.provide(
      ConnectionConfigLive.pipe(
        Layer.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown(credentials ? { RESEND_API_KEY: 're_fake-test-key' } : {}),
          ),
        ),
      ),
    ),
  );

it('sends an authenticated idempotent Resend request with the exact message and reply address', async () => {
  const requests: HttpClientRequest.HttpClientRequest[] = [];
  expect(
    await Effect.runPromise(
      EmailTransport.use((transport) => transport.send(input)).pipe(
        Effect.provide(layer(200, { id: providerId }, requests)),
      ),
    ),
  ).toBe(providerId);
  const request = requests[0];
  expect(request?.url).toBe('https://api.resend.com/emails');
  expect(request?.headers['authorization']).toBe('Bearer re_fake-test-key');
  expect(request?.headers['idempotency-key']).toBe(`froment-email-test/${input.requestId}`);
  expect(request?.body._tag).toBe('Uint8Array');
  if (request?.body._tag !== 'Uint8Array') throw new Error('Expected a JSON request body.');
  expect(new TextDecoder().decode(request.body.body)).toBe(
    JSON.stringify({
      from: input.from,
      reply_to: input.replyTo,
      to: [input.recipient],
      subject: input.subject,
      text: input.body,
    }),
  );
});

it.each([200, 403])('releases HTTP resources after status %s', async (status) => {
  const signals: AbortSignal[] = [];
  await Effect.runPromise(
    EmailTransport.use((transport) => transport.send(input)).pipe(
      Effect.provide(layer(status, { id: providerId }, [], true, signals)),
      Effect.result,
    ),
  );
  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(true);
});

it.each([
  [403, 'emailTest.rejected', false],
  [429, 'emailTest.rateLimited', true],
  [503, 'emailTest.unavailable', true],
] as const)(
  'classifies HTTP %s without exposing provider payloads',
  async (status, code, retryable) => {
    const failure = await Effect.runPromise(
      EmailTransport.use((transport) => transport.send(input)).pipe(
        Effect.provide(
          layer(status, { message: 'Provider diagnostic containing private data' }, []),
        ),
        Effect.flip,
      ),
    );
    expect(failure).toMatchObject({ code, retryable });
    expect(JSON.stringify(failure)).not.toContain('private data');
  },
);

it('rejects missing credentials before any network request and rejects malformed success bodies', async () => {
  const requests: HttpClientRequest.HttpClientRequest[] = [];
  const failure = await Effect.runPromise(
    EmailTransport.use((transport) => transport.send(input)).pipe(
      Effect.provide(layer(200, {}, requests, false)),
      Effect.flip,
    ),
  );
  expect(failure).toMatchObject({ code: 'emailTest.credentialsMissing' });
  expect(requests).toHaveLength(0);
  const malformed = await Effect.runPromise(
    EmailTransport.use((transport) => transport.send(input)).pipe(
      Effect.provide(layer(200, { id: 'invalid' }, [])),
      Effect.flip,
    ),
  );
  expect(malformed).toMatchObject({ code: 'emailTest.unavailable' });
});

it.each([
  ['concurrent_idempotent_requests', true],
  ['resource_locked', true],
  ['invalid_idempotent_request', false],
  ['unrecognized', false],
] as const)(
  'classifies conflict %s without replacing the idempotency key',
  async (name, retryable) => {
    const requests: HttpClientRequest.HttpClientRequest[] = [];
    const failure = await Effect.runPromise(
      EmailTransport.use((transport) => transport.send(input)).pipe(
        Effect.provide(layer(409, { name }, requests)),
        Effect.flip,
      ),
    );
    expect(failure).toMatchObject({ retryable });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers['idempotency-key']).toBe(`froment-email-test/${input.requestId}`);
  },
);

it.each([
  ['sent', 'accepted'],
  ['delivery_delayed', 'accepted'],
  ['delivered', 'delivered'],
  ['bounced', 'bounced'],
] as const)('maps provider delivery event %s', async (event, expected) => {
  expect(
    await Effect.runPromise(
      EmailTransport.use((transport) => transport.delivery(providerId)).pipe(
        Effect.provide(layer(200, { last_event: event }, [])),
      ),
    ),
  ).toBe(expected);
});
