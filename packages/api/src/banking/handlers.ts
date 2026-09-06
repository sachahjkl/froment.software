import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Banking } from './service.js';

export const BankingHandlers = HttpApiBuilder.group(Api, 'banking', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'bankTransactionList',
        Effect.fn('bankTransactionList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankImport',
        Effect.fn('bankImport')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .importStatement(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankMatch',
        Effect.fn('bankMatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .match(params.transactionId, payload.paymentId, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankUnmatch',
        Effect.fn('bankUnmatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .unmatch(
              params.transactionId,
              payload.matchId,
              payload.reason,
              (yield* ApiPrincipal).userId,
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
