import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';

import { setPrivateResponseHeaders } from '../http/response.js';
import { Clients } from './clients.js';

export const ClientHandlers = HttpApiBuilder.group(Api, 'clients', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'clientList',
        Effect.fn('clientList')(function* () {
          yield* setPrivateResponseHeaders;
          const clients = yield* Clients;
          return yield* clients.list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientGet',
        Effect.fn('clientGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Clients)
            .get(params.clientId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientCreate',
        Effect.fn('clientCreate')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          const clients = yield* Clients;
          return yield* clients
            .create(payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientUpdate',
        Effect.fn('clientUpdate')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Clients)
            .update(params.clientId, payload, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientArchive',
        Effect.fn('clientArchive')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          const clients = yield* Clients;
          return yield* clients
            .archive(params.clientId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientReactivate',
        Effect.fn('clientReactivate')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          return yield* (yield* Clients)
            .reactivate(params.clientId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'clientAccessCreate',
        Effect.fn('clientAccessCreate')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          const principal = yield* ApiPrincipal;
          const clients = yield* Clients;
          return yield* clients
            .createAccess(params.clientId, principal.userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
