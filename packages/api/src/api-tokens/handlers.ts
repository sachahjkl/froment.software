import { Api, ApiPrincipal, Ulid } from '@froment/contracts';
import { Effect, Schema } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { ApiTokens } from './service.js';

export const ApiTokenHandlers = HttpApiBuilder.group(Api, 'apiTokens', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'apiTokenList',
        Effect.fn('apiTokenList')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* ApiTokens)
            .list(query.cursor, query.limit)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'apiTokenCreate',
        Effect.fn('apiTokenCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* ApiTokens)
            .create(payload, Schema.decodeUnknownSync(Ulid)(principal.userId))
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'apiTokenRevoke',
        Effect.fn('apiTokenRevoke')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* ApiTokens)
            .revoke(params.tokenId, Schema.decodeUnknownSync(Ulid)(principal.userId))
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
