import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Integrations } from './service.js';

export const IntegrationHandlers = HttpApiBuilder.group(Api, 'integrations', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'integrationStatus',
        Effect.fn('integrationStatus')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Integrations).status;
        }),
      )
      .handle(
        'integrationOperationList',
        Effect.fn('integrationOperationList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Integrations).list.pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
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
