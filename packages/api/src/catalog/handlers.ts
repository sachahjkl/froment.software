import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Catalog } from './service.js';

export const CatalogHandlers = HttpApiBuilder.group(Api, 'catalog', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'catalogList',
        Effect.fn('catalogList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Catalog).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'catalogCreate',
        Effect.fn('catalogCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Catalog)
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'catalogUpdate',
        Effect.fn('catalogUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Catalog)
            .update(params.itemId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
