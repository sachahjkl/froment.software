import { Effect, Layer, Option, Redacted, Schema } from 'effect';
import { createHash } from 'node:crypto';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http';
import { RateLimiter } from 'effect/unstable/persistence';
import { ConnectionConfig } from './connection-config.js';
import { EmailTransport, EmailTransportError, type OutgoingEmail } from './email-transport.js';

const SentEmail = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
const Conflict = Schema.Struct({ name: Schema.String });
const Delivery = Schema.Struct({
  last_event: Schema.Literals([
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'opened',
    'clicked',
    'failed',
    'scheduled',
    'canceled',
    'suppressed',
  ]),
});

export const ResendEmailTransportLive = Layer.effect(
  EmailTransport,
  Effect.gen(function* () {
    const config = yield* ConnectionConfig;
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.withScope,
      HttpClient.withRateLimiter({
        limiter: yield* RateLimiter.RateLimiter,
        window: '1 second',
        limit: 2,
        key: 'resend',
        times: 0,
      }),
    );
    const execute = Effect.fn('Resend.execute')(function* (
      request: HttpClientRequest.HttpClientRequest,
    ) {
      if (Option.isNone(config.resend))
        return yield* new EmailTransportError({
          code: 'emailTest.credentialsMissing',
          retryable: false,
        });
      const response = yield* client
        .execute(
          request.pipe(
            HttpClientRequest.prependUrl('https://api.resend.com'),
            HttpClientRequest.bearerToken(config.resend.value),
            HttpClientRequest.acceptJson,
          ),
        )
        .pipe(
          Effect.mapError(
            () => new EmailTransportError({ code: 'emailTest.unavailable', retryable: true }),
          ),
        );
      if (response.status === 429)
        return yield* new EmailTransportError({ code: 'emailTest.rateLimited', retryable: true });
      if (response.status >= 500 || response.status === 408)
        return yield* new EmailTransportError({ code: 'emailTest.unavailable', retryable: true });
      if (response.status === 409) {
        const conflict = yield* HttpClientResponse.schemaBodyJson(Conflict)(response).pipe(
          Effect.mapError(
            () => new EmailTransportError({ code: 'emailTest.rejected', retryable: false }),
          ),
        );
        const retryable =
          conflict.name === 'concurrent_idempotent_requests' || conflict.name === 'resource_locked';
        return yield* new EmailTransportError({
          code: retryable ? 'emailTest.unavailable' : 'emailTest.rejected',
          retryable,
        });
      }
      if (response.status < 200 || response.status >= 300)
        return yield* new EmailTransportError({ code: 'emailTest.rejected', retryable: false });
      return response;
    });
    const send = Effect.fn('Resend.send')(
      function* (email: OutgoingEmail) {
        const request = yield* HttpClientRequest.post('/emails').pipe(
          HttpClientRequest.setHeader('Idempotency-Key', `froment-email-test/${email.requestId}`),
          HttpClientRequest.bodyJson({
            from: email.from,
            reply_to: email.replyTo,
            to: [email.recipient],
            subject: email.subject,
            text: email.body,
          }),
          Effect.mapError(
            () => new EmailTransportError({ code: 'emailTest.rejected', retryable: false }),
          ),
        );
        const response = yield* execute(request);
        const result = yield* HttpClientResponse.schemaBodyJson(SentEmail)(response).pipe(
          Effect.mapError(
            () => new EmailTransportError({ code: 'emailTest.unavailable', retryable: true }),
          ),
        );
        return result.id;
      },
      Effect.scoped,
      Effect.timeout('20 seconds'),
      Effect.catchTag('TimeoutError', () =>
        Effect.fail(new EmailTransportError({ code: 'emailTest.unavailable', retryable: true })),
      ),
    );
    const delivery = Effect.fn('Resend.delivery')(
      function* (providerId: string) {
        const response = yield* execute(
          HttpClientRequest.get(`/emails/${encodeURIComponent(providerId)}`),
        );
        const result = yield* HttpClientResponse.schemaBodyJson(Delivery)(response).pipe(
          Effect.mapError(
            () =>
              new EmailTransportError({ code: 'emailTest.statusUnavailable', retryable: false }),
          ),
        );
        switch (result.last_event) {
          case 'delivered':
          case 'opened':
          case 'clicked':
            return 'delivered' as const;
          case 'bounced':
            return 'bounced' as const;
          case 'complained':
            return 'complained' as const;
          case 'failed':
          case 'canceled':
          case 'suppressed':
            return 'failed' as const;
          default:
            return 'accepted' as const;
        }
      },
      Effect.scoped,
      Effect.timeout('10 seconds'),
      Effect.catchTag('TimeoutError', () =>
        Effect.fail(
          new EmailTransportError({ code: 'emailTest.statusUnavailable', retryable: true }),
        ),
      ),
    );
    const accountKey = Option.isSome(config.resend)
      ? createHash('sha256').update(Redacted.value(config.resend.value)).digest('hex')
      : null;
    return EmailTransport.of({ accountKey, send, delivery });
  }),
).pipe(Layer.provide(RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory))));
