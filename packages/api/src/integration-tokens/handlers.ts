import { Api, ApiPrincipal, Ulid } from '@froment/contracts';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { IntegrationTokens } from './service.js';

export const IntegrationTokenHandlers = HttpApiBuilder.group(Api, 'integrationTokens', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'integrationTokenList',
        Effect.fn('integrationTokenList')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* IntegrationTokens)
            .list(query.cursor, query.limit)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'integrationTokenCreate',
        Effect.fn('integrationTokenCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* IntegrationTokens)
            .create(payload, Schema.decodeUnknownSync(Ulid)(principal.userId))
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'integrationTokenRevoke',
        Effect.fn('integrationTokenRevoke')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* IntegrationTokens)
            .revoke(params.tokenId, Schema.decodeUnknownSync(Ulid)(principal.userId))
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
