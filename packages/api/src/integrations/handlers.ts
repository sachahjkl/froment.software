import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Integrations } from './service.js';
import { IntegrationRetries } from './retries.js';
import { ConnectionConfig } from './connection-config.js';
import { EmailTests } from './email-test-service.js';
import { Checkouts } from './checkout-service.js';

export const IntegrationHandlers = HttpApiBuilder.group(Api, 'integrations', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'checkoutConnection',
        Effect.fn('checkoutConnection')(function* () {
          yield* setPrivateResponseHeaders;
          return (yield* Checkouts).connection;
        }),
      )
      .handle(
        'checkoutList',
        Effect.fn('checkoutList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Checkouts)
            .list()
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'checkoutCreate',
        Effect.fn('checkoutCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Checkouts)
            .enqueue(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'checkoutReconcile',
        Effect.fn('checkoutReconcile')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Checkouts)
            .reconcile(params.requestId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'providerConnections',
        Effect.fn('providerConnections')(function* () {
          yield* setPrivateResponseHeaders;
          return (yield* ConnectionConfig).connections;
        }),
      )
      .handle(
        'emailTestList',
        Effect.fn('emailTestList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* EmailTests)
            .list()
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'emailTestCreate',
        Effect.fn('emailTestCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* EmailTests)
            .enqueue(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'integrationRetryList',
        Effect.fn('integrationRetryList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* IntegrationRetries).list.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle(
        'integrationStatus',
        Effect.fn('integrationStatus')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Integrations).status;
        }),
      )
      .handle(
        'integrationOperationList',
        Effect.fn('integrationOperationList')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Integrations)
            .list(query.kind)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'integrationOperationCreate',
        Effect.fn('integrationOperationCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Integrations)
            .submit(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
